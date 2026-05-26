/**
 * KernelWallet Network Manager
 * Multi-chain network configurations and RPC management
 */

const NETWORKS = {
  // EVM Networks
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    rpcUrls: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com'
    ],
    blockExplorer: 'https://etherscan.io',
    color: '#627EEA',
    isEVM: true,
    nativeCurrency: 'ETH'
  },
  
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon.llamarpc.com'
    ],
    blockExplorer: 'https://polygonscan.com',
    color: '#8247E5',
    isEVM: true,
    nativeCurrency: 'MATIC'
  },
  
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    symbol: 'ARB',
    decimals: 18,
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum.llamarpc.com'
    ],
    blockExplorer: 'https://arbiscan.io',
    color: '#28A0F0',
    isEVM: true,
    nativeCurrency: 'ETH'
  },
  
  plasma: {
    id: 'plasma',
    name: 'Plasma',
    chainId: 1337, // Example - update with real value
    symbol: 'PPAY',
    decimals: 18,
    rpcUrls: [
      'https://rpc.plasma.finance'
    ],
    blockExplorer: 'https://explorer.plasma.finance',
    color: '#FF6B6B',
    isEVM: true,
    nativeCurrency: 'PPAY'
  },
  
  // Bitcoin
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    chainId: null,
    symbol: 'BTC',
    decimals: 8,
    rpcUrls: [
      'https://blockchain.info',
      'https://api.blockcypher.com/v1/btc/main'
    ],
    blockExplorer: 'https://blockchain.info',
    color: '#F7931A',
    isEVM: false,
    nativeCurrency: 'BTC'
  },
  
  // Lightning Network
  lightning: {
    id: 'lightning',
    name: 'Lightning Network',
    chainId: null,
    symbol: 'BTC',
    decimals: 8,
    rpcUrls: [
      'https://api.sparkwallet.io' // Spark placeholder
    ],
    blockExplorer: 'https://1ml.com',
    color: '#792EE5',
    isEVM: false,
    nativeCurrency: 'BTC',
    isLayer2: true,
    parentNetwork: 'bitcoin'
  },
  
  // Solana
  solana: {
    id: 'solana',
    name: 'Solana',
    chainId: null,
    symbol: 'SOL',
    decimals: 9,
    rpcUrls: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://rpc.ankr.com/solana'
    ],
    blockExplorer: 'https://solscan.io',
    color: '#14F195',
    isEVM: false,
    nativeCurrency: 'SOL'
  }
};

// Asset configurations
const ASSETS = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    networks: ['bitcoin', 'lightning'],
    decimals: 8,
    color: '#F7931A'
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    networks: ['ethereum', 'polygon', 'arbitrum', 'solana', 'plasma'],
    decimals: 6,
    color: '#26A17B',
    contractAddresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      arbitrum: '0xFd086bC7CD5C48D4638C5c4c0A71eEa9bCb8eB2c',
      solana: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      plasma: '0x0000000000000000000000000000000000000001' // Placeholder
    }
  },
  XAUt: {
    symbol: 'XAUt',
    name: 'Tether Gold',
    networks: ['ethereum'],
    decimals: 6,
    color: '#FFD700',
    contractAddresses: {
      ethereum: '0x68749665FF8D2d112Fa859AA293F07A62c7b6f3C'
    }
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    networks: ['ethereum', 'polygon', 'arbitrum'],
    decimals: 18,
    color: '#627EEA',
    isNative: true
  },
  MATIC: {
    symbol: 'MATIC',
    name: 'Polygon',
    networks: ['polygon'],
    decimals: 18,
    color: '#8247E5',
    isNative: true
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    networks: ['solana'],
    decimals: 9,
    color: '#14F195',
    isNative: true
  },
  ARB: {
    symbol: 'ARB',
    name: 'Arbitrum',
    networks: ['arbitrum'],
    decimals: 18,
    color: '#28A0F0',
    isNative: true
  }
};

let currentNetwork = 'ethereum';
let customRpcs = {};

/**
 * Get all available networks
 * @returns {object}
 */
function getAllNetworks() {
  return { ...NETWORKS };
}

/**
 * Get network config by ID
 * @param {string} networkId 
 * @returns {object|null}
 */
function getNetwork(networkId) {
  return NETWORKS[networkId] || null;
}

/**
 * Get current active network
 * @returns {object}
 */
function getCurrentNetwork() {
  return NETWORKS[currentNetwork];
}

/**
 * Set current network
 * @param {string} networkId 
 */
function setCurrentNetwork(networkId) {
  if (!NETWORKS[networkId]) {
    throw new Error(`Unknown network: ${networkId}`);
  }
  currentNetwork = networkId;
}

/**
 * Get active RPC URL (with fallback)
 * @param {string} networkId 
 * @returns {string}
 */
function getActiveRpc(networkId) {
  const network = NETWORKS[networkId];
  if (!network) throw new Error('Network not found');
  
  // Check custom RPC first
  if (customRpcs[networkId]) {
    return customRpcs[networkId];
  }
  
  // Return first default RPC (in production, rotate on failure)
  return network.rpcUrls[0];
}

/**
 * Set custom RPC for network
 * @param {string} networkId 
 * @param {string} rpcUrl 
 */
function setCustomRpc(networkId, rpcUrl) {
  customRpcs[networkId] = rpcUrl;
}

/**
 * Get asset config
 * @param {string} symbol 
 * @returns {object|null}
 */
function getAsset(symbol) {
  return ASSETS[symbol.toUpperCase()] || null;
}

/**
 * Get all supported assets
 * @returns {object}
 */
function getAllAssets() {
  return { ...ASSETS };
}

/**
 * Get assets supported on a network
 * @param {string} networkId 
 * @returns {array}
 */
function getAssetsForNetwork(networkId) {
  return Object.values(ASSETS).filter(asset => 
    asset.networks.includes(networkId)
  );
}

/**
 * Get native currency of network
 * @param {string} networkId 
 * @returns {string}
 */
function getNativeCurrency(networkId) {
  const network = NETWORKS[networkId];
  return network ? network.nativeCurrency : null;
}

/**
 * Check if network is EVM compatible
 * @param {string} networkId 
 * @returns {boolean}
 */
function isEVMNetwork(networkId) {
  const network = NETWORKS[networkId];
  return network ? network.isEVM : false;
}

/**
 * Get contract address for token on network
 * @param {string} tokenSymbol 
 * @param {string} networkId 
 * @returns {string|null}
 */
function getTokenContract(tokenSymbol, networkId) {
  const asset = ASSETS[tokenSymbol.toUpperCase()];
  if (!asset || !asset.contractAddresses) return null;
  return asset.contractAddresses[networkId] || null;
}

/**
 * Get block explorer URL for address
 * @param {string} address 
 * @param {string} networkId 
 * @returns {string}
 */
function getExplorerUrl(address, networkId) {
  const network = NETWORKS[networkId];
  if (!network || !network.blockExplorer) return '#';
  return `${network.blockExplorer}/address/${address}`;
}

/**
 * Get transaction explorer URL
 * @param {string} txHash 
 * @param {string} networkId 
 * @returns {string}
 */
function getTxExplorerUrl(txHash, networkId) {
  const network = NETWORKS[networkId];
  if (!network || !network.blockExplorer) return '#';
  return `${network.blockExplorer}/tx/${txHash}`;
}

export {
  NETWORKS,
  ASSETS,
  getAllNetworks,
  getNetwork,
  getCurrentNetwork,
  setCurrentNetwork,
  getActiveRpc,
  setCustomRpc,
  getAsset,
  getAllAssets,
  getAssetsForNetwork,
  getNativeCurrency,
  isEVMNetwork,
  getTokenContract,
  getExplorerUrl,
  getTxExplorerUrl
};
