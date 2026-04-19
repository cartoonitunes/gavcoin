/**
 * GavCoin DApp - Resurrected 2026
 * 
 * Original contract by Gavin Wood, deployed April 26, 2016.
 * Pre-ERC20 token with custom mining mechanism.
 * 
 * Contract: 0xb4abc1bfc403a7b82c777420c81269858a4b8aa4
 * Chain: Ethereum mainnet
 */

import { ethers } from "https://esm.sh/ethers@6";

// --- Constants ---
const CONTRACT = "0xb4abc1bfc403a7b82c777420c81269858a4b8aa4";
const DEPLOY_BLOCK = 1408600;
const RPC_URL = "https://rarible.com/nodes/ethereum-node";

const ABI = [
  "function mine()",
  "function sendCoin(uint256 _val, address _to)",
  "function sendCoinFrom(address _from, uint256 _val, address _to)",
  "function coinBalanceOf(address _a) view returns (uint256)",
  "function coinBalance() view returns (uint256)",
  "function isApproved(address _proxy) view returns (bool)",
  "function isApprovedFor(address _target, address _proxy) view returns (bool)",
  "function approve(address _a)",
  // Events inferred from the contract behavior
  // The original contract uses logging for sends
];

// Storage slot 3 = m_lastNumberMined (Solidity layout: m_balances=0, m_approved=1, owner=2, m_lastNumberMined=3)
const LAST_MINED_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000003";

// --- State ---
let provider = null;
let signer = null;
let contract = null;       // read-only
let writeContract = null;  // with signer
let userAddress = null;

// --- DOM refs ---
const gavEl = document.getElementById("gav");
const addrEl = document.getElementById("addrText");
const connectBtn = document.getElementById("connectBtn");
const mineBtn = document.getElementById("mine");
const sendBtn = document.getElementById("send");
const latestEl = document.getElementById("latest");
const mineableEl = document.getElementById("mineableBlocks");
const mineRewardEl = document.getElementById("mineReward");

// --- Init ---
async function init() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT, ABI, provider);
    await updateMineableBlocks();
    await loadRecentEvents();
  } catch (e) {
    console.error("Init error:", e);
    setStatus("Failed to connect to Ethereum RPC");
  }
}

// --- Wallet connection ---
function getInjectedProvider() {
  if (!window.ethereum) return null;

  const providers = window.ethereum.providers;
  if (Array.isArray(providers) && providers.length) {
    return (
      providers.find((p) => p.isCoinbaseWallet) ||
      providers.find((p) => p.isMetaMask) ||
      providers[0]
    );
  }

  return window.ethereum;
}

window.connectWallet = async function() {
  const injectedProvider = getInjectedProvider();
  if (!injectedProvider) {
    alert("No Ethereum wallet detected. Please install a wallet extension.");
    return;
  }

  connectBtn.disabled = true;
  const originalText = connectBtn.textContent;
  connectBtn.textContent = "Connecting...";

  try {
    if (typeof injectedProvider.request !== "function") {
      throw new Error("Injected wallet provider is missing request()");
    }

    await injectedProvider.request({ method: "eth_requestAccounts" });

    const browserProvider = new ethers.BrowserProvider(injectedProvider, "any");
    const network = await browserProvider.getNetwork();
    if (network.chainId !== 1n) {
      throw new Error("Please switch to Ethereum mainnet.");
    }

    signer = await browserProvider.getSigner();
    userAddress = await signer.getAddress();
    writeContract = new ethers.Contract(CONTRACT, ABI, signer);

    connectBtn.style.display = "none";
    addrEl.style.display = "inline";
    addrEl.textContent = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

    await updateBalance();
  } catch (e) {
    console.error("Connect error:", e);
    const message = e?.info?.error?.message || e?.shortMessage || e?.message || "Unknown wallet error";
    alert("Failed to connect wallet: " + message);
  } finally {
    connectBtn.disabled = false;
    connectBtn.textContent = originalText;
  }
};

// --- Balance ---
async function updateBalance() {
  if (!userAddress) return;
  try {
    const raw = await contract.coinBalanceOf(userAddress);
    gavEl.textContent = formatGav(raw);
  } catch (e) {
    console.error("Balance error:", e);
    gavEl.textContent = "?";
  }
}

function formatGav(raw) {
  return (Number(raw) / 1000).toLocaleString();
}

// --- Mineable blocks ---
async function updateMineableBlocks() {
  try {
    const lastMined = await provider.getStorage(CONTRACT, LAST_MINED_SLOT);
    const lastMinedBlock = Number(BigInt(lastMined));
    const currentBlock = await provider.getBlockNumber();
    const mineable = currentBlock - (lastMinedBlock || DEPLOY_BLOCK);
    mineableEl.textContent = mineable.toLocaleString();
    // 1 GAV per block to caller (and 1 to validator)
    mineRewardEl.textContent = mineable.toLocaleString();
    mineBtn.textContent = "mine";
  } catch (e) {
    console.error("Mineable blocks error:", e);
    mineableEl.textContent = "?";
  }
}

// --- Mine ---
window.doMine = async function() {
  if (!writeContract) {
    alert("Please connect your wallet first.");
    return;
  }
  // Check if there are blocks to mine
  try {
    const lastMined = await provider.getStorage(CONTRACT, LAST_MINED_SLOT);
    const lastMinedBlock = Number(BigInt(lastMined));
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= lastMinedBlock) {
      alert("No blocks to mine right now. Someone just mined.");
      return;
    }
  } catch (_) {}

  try {
    mineBtn.disabled = true;
    mineBtn.textContent = "mining...";
    const tx = await writeContract.mine();
    setStatus('Mining tx sent. <a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View on Etherscan</a>', "pending");
    await tx.wait();
    setStatus('Mined successfully! <a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View transaction</a>', "success");
    // Use a short delay to let the RPC catch up
    await new Promise(r => setTimeout(r, 2000));
    await updateBalance();
    await updateMineableBlocks();
    await loadRecentEvents();
  } catch (e) {
    console.error("Mine error:", e);
    alert("Mine failed: " + (e.reason || e.message));
  } finally {
    mineBtn.disabled = false;
    await updateMineableBlocks();
  }
};

// --- Send ---
window.doSend = async function() {
  if (!writeContract) {
    alert("Please connect your wallet first.");
    return;
  }
  const valInput = document.getElementById("val").value.trim();
  const toInput = document.getElementById("to").value.trim();

  if (!valInput || isNaN(Number(valInput))) {
    alert("Please enter a valid amount.");
    return;
  }
  if (!ethers.isAddress(toInput)) {
    alert("Please enter a valid Ethereum address.");
    return;
  }

  // Display GAV to raw: multiply by 1000
  const rawVal = Math.round(Number(valInput) * 1000);
  if (rawVal <= 0) {
    alert("Amount must be greater than zero.");
    return;
  }

  // Check balance before sending
  try {
    const balance = await contract.coinBalanceOf(userAddress);
    if (Number(balance) < rawVal) {
      alert("Insufficient balance. You have " + formatGav(balance) + " GAV.");
      return;
    }
  } catch (_) {}

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = "sending...";
    const tx = await writeContract.sendCoin(rawVal, toInput);
    setStatus('Sending ' + valInput + ' GAV. <a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View on Etherscan</a>', "pending");
    await tx.wait();
    setStatus('Sent ' + valInput + ' GAV! <a href="https://etherscan.io/tx/' + tx.hash + '" target="_blank">View transaction</a>', "success");
    document.getElementById("val").value = "";
    document.getElementById("to").value = "";
    await updateBalance();
    await loadRecentEvents();
  } catch (e) {
    console.error("Send error:", e);
    alert("Send failed: " + (e.reason || e.message));
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "send";
  }
};

// --- Activity history via Blockscout API (no key needed) ---
const BLOCKSCOUT_API = "https://eth.blockscout.com/api";

const METHODS = {
  "0x99f4b251": "mine",
  "0x67eae672": "sendCoinFrom",
  "0xc86a90fe": "sendCoin",
  "0xdaea85c5": "approve",
  "0x06005754": "owner",
  "0xbbd39ac0": "coinBalance",
  "0xa550f86d": "coinBalanceOf",
};

function decodeMethod(tx) {
  if (tx.functionName) {
    return tx.functionName.split("(")[0] || "call";
  }
  if (!tx.input || tx.input === "0x") return "mine";
  const sel = tx.input.slice(0, 10).toLowerCase();
  return METHODS[sel] || "call";
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(ts) {
  const secs = Math.floor(Date.now() / 1000) - Number(ts);
  if (secs < 60) return secs + "s ago";
  if (secs < 3600) return Math.floor(secs / 60) + "m ago";
  if (secs < 86400) return Math.floor(secs / 3600) + "h ago";
  return Math.floor(secs / 86400) + "d ago";
}

async function resolveENS(addresses) {
  const names = {};
  try {
    const lookups = addresses.map(async (addr) => {
      try {
        const name = await provider.lookupAddress(addr);
        if (name) names[addr.toLowerCase()] = name;
      } catch (_) {}
    });
    await Promise.all(lookups);
  } catch (_) {}
  return names;
}

async function loadRecentEvents() {
  try {
    const url = `${BLOCKSCOUT_API}?module=account&action=txlist&address=${CONTRACT}&page=1&offset=25&sort=desc`;
    const resp = await fetch(url);
    const data = await resp.json();

    latestEl.innerHTML = "";

    if (data.status !== "1" || !data.result || data.result.length === 0) {
      latestEl.innerHTML = '<li class="placeholder">No activity found.</li>';
      return;
    }

    // Collect unique addresses for ENS resolution
    const addresses = [...new Set(data.result.filter(tx => tx.isError !== "1").map(tx => tx.from))];
    const ensNames = await resolveENS(addresses);

    for (const tx of data.result) {
      if (tx.isError === "1") continue;
      const method = decodeMethod(tx);
      const li = document.createElement("li");
      const methodClass = method === "mine" ? "mine" : method.startsWith("send") ? "send-out" : "event-addr";
      const displayAddr = ensNames[tx.from.toLowerCase()] || tx.from;
      const txLink = `https://etherscan.io/tx/${tx.hash}`;

      li.innerHTML =
        `<a href="${txLink}" target="_blank" rel="noopener" class="event-block">${timeAgo(tx.timeStamp)}</a>` +
        `<span class="${methodClass}">${method.toUpperCase()}</span> ` +
        `<span class="event-addr">${displayAddr}</span>`;

      latestEl.appendChild(li);
    }
  } catch (e) {
    console.error("Activity error:", e);
    latestEl.innerHTML = '<li class="placeholder">Could not load activity.</li>';
  }
}

// --- Status/confirmation helper ---
function setStatus(msg, type) {
  // type: "pending", "success", "error"
  let el = document.getElementById("status");
  if (!el) {
    el = document.createElement("div");
    el.id = "status";
    document.getElementById("controls").insertAdjacentElement("afterend", el);
  }
  el.className = "status-" + (type || "pending");
  el.innerHTML = msg;
  if (type === "success") {
    setTimeout(() => { if (el.innerHTML === msg) { el.innerHTML = ""; el.className = ""; } }, 15000);
  }
}

// --- Input validation ---
function setupValidation() {
  const valEl = document.getElementById("val");
  const toEl = document.getElementById("to");
  const sendEl = document.getElementById("send");

  valEl.addEventListener("input", () => {
    const v = valEl.value.trim();
    if (v === "") { valEl.className = ""; return; }
    const n = Number(v);
    valEl.className = (isNaN(n) || n <= 0) ? "invalid" : "valid";
    updateSendBtn();
  });

  toEl.addEventListener("input", () => {
    const v = toEl.value.trim();
    if (v === "") { toEl.className = ""; return; }
    toEl.className = ethers.isAddress(v) ? "valid" : (v.length < 42 ? "maybevalid" : "invalid");
    updateSendBtn();
  });

  function updateSendBtn() {
    const valOk = valEl.className === "valid";
    const toOk = toEl.className === "valid";
    sendEl.className = (valOk && toOk) ? "" : "invalid";
  }
}
setupValidation();

// --- Wallet events ---
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}

// --- Auto-refresh mineable blocks every 30s ---
setInterval(async () => {
  try { await updateMineableBlocks(); } catch (_) {}
}, 30000);

// --- Start ---
init();
