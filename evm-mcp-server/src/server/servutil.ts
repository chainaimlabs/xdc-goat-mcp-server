import { defineChain } from 'viem'

// XDC Mainnet
export const xdcMainnet = defineChain({
  id: 50,
  name: 'XDC Network',
  network: 'xdc',
  nativeCurrency: {
    name: 'XDC',
    symbol: 'XDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.xinfin.network'] },
    public: { http: ['https://rpc.xinfin.network'] },
  },
  blockExplorers: {
    default: { name: 'XinFin Explorer', url: 'https://explorer.xinfin.network' },
  },
  testnet: false,
})


// XDC Apothem Testnet
export const xdcApothemTestnet = defineChain( {
  id: 51,
  name: 'XDC Apothem Testnet Network',
  network: 'XDC Apothem Network',
  nativeCurrency: {
    name: 'XDC',
    symbol: 'XDC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.apothem.network'] },
    public: { http: ['https://rpc.apothem.network'] },
  },
  blockExplorers: {
    default: { name: 'XDC Apothem Testnet Explorer', url: 'https://testnet.xdcscan.com/' },
  },
  testnet: true,
})