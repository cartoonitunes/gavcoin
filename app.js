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

// Mining event topic and send event - we'll use raw logs
// Storage slot 0x42 = lastBlockMined (from LLL source)
const LAST_MINED_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000042";

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
window.connectWallet = async function() {
  if (!window.ethereum) {
    alert("No Ethereum wallet detected. Please install MetaMask.");
    return;
  }
  try {
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await browserProvider.send("eth_requestAccounts", []);
    
    // Check chain
    const network = await browserProvider.getNetwork();
    if (network.chainId !== 1n) {
      alert("Please switch to Ethereum mainnet.");
      return;
    }

    signer = await browserProvider.getSigner();
    userAddress = await signer.getAddress();
    writeContract = new ethers.Contract(CONTRACT, ABI, signer);

    // Update UI
    connectBtn.style.display = "none";
    addrEl.style.display = "inline";
    addrEl.textContent = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);

    await updateBalance();
  } catch (e) {
    console.error("Connect error:", e);
    alert("Failed to connect wallet: " + e.message);
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
  try {
    mineBtn.disabled = true;
    mineBtn.textContent = "mining...";
    const tx = await writeContract.mine();
    setStatus("Mining tx sent: " + tx.hash.slice(0, 10) + "...");
    await tx.wait();
    setStatus("Mined successfully!");
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

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = "sending...";
    const tx = await writeContract.sendCoin(rawVal, toInput);
    setStatus("Send tx: " + tx.hash.slice(0, 10) + "...");
    await tx.wait();
    setStatus("Sent " + valInput + " GAV!");
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

function decodeMethod(tx) {
  // Etherscan provides functionName directly
  if (tx.functionName) {
    const name = tx.functionName.split("(")[0];
    return name || "call";
  }
  if (!tx.input || tx.input === "0x") return "mine";
  return "call";
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

// --- Status helper ---
function setStatus(msg) {
  let el = document.getElementById("status");
  if (!el) {
    el = document.createElement("div");
    el.id = "status";
    document.getElementById("main").appendChild(el);
  }
  el.textContent = msg;
  // Auto-clear after 10s
  setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 10000);
}

// --- Wallet events ---
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}

// --- Start ---
init();
