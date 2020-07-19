import Vue from 'vue';
import { ethers } from 'ethers';
import { AddressZero } from 'ethers/constants';
import { formatEther, getAddress, Interface } from 'ethers/utils';
import abi from '@/helpers/abi';
import BigNumber from '@/helpers/bignumber';
import config from '@/helpers/config';
import connectors from '@/helpers/connectors';

const infuraId = process.env.VUE_APP_INFURA_ID;
const backupUrls = {
  1: `https://mainnet.infura.io/v3/${infuraId}`,
  42: `https://kovan.infura.io/v3/${infuraId}`
};
let provider;
let web3;

const state = {
  injectedLoaded: false,
  injectedChainId: null,
  account: null,
  name: null,
  active: false,
  balances: {},
  dsProxyAddress: null,
  proxyAllowances: {},
  tokenMetadata: {}
};

const getters = {
  hasProxy: state => {
    const proxyAddress = state.dsProxyAddress;
    return !!proxyAddress && proxyAddress !== AddressZero;
  }
};

const mutations = {
  LOAD_TOKEN_METADATA_REQUEST() {
    console.debug('LOAD_TOKEN_METADATA_REQUEST');
  },
  LOAD_TOKEN_METADATA_SUCCESS(_state, payload) {
    for (const address in payload) {
      Vue.set(_state.tokenMetadata, address, payload[address]);
    }
    console.debug('LOAD_TOKEN_METADATA_SUCCESS');
  },
  LOAD_TOKEN_METADATA_FAILURE(_state, payload) {
    console.debug('LOAD_TOKEN_METADATA_FAILURE', payload);
  },
  LOAD_WEB3_REQUEST() {
    console.debug('LOAD_WEB3_REQUEST');
  },
  LOAD_WEB3_SUCCESS() {
    console.debug('LOAD_WEB3_SUCCESS');
  },
  LOAD_WEB3_FAILURE(_state, payload) {
    console.debug('LOAD_WEB3_FAILURE', payload);
  },
  LOAD_PROVIDER_REQUEST() {
    console.debug('LOAD_PROVIDER_REQUEST');
  },
  LOAD_PROVIDER_SUCCESS(_state, payload) {
    Vue.set(_state, 'injectedLoaded', payload.injectedLoaded);
    Vue.set(_state, 'injectedChainId', payload.injectedChainId);
    Vue.set(_state, 'account', payload.account);
    Vue.set(_state, 'name', payload.name);
    console.debug('LOAD_PROVIDER_SUCCESS');
  },
  LOAD_PROVIDER_FAILURE(_state, payload) {
    Vue.set(_state, 'injectedLoaded', false);
    Vue.set(_state, 'injectedChainId', null);
    Vue.set(_state, 'account', null);
    Vue.set(_state, 'active', false);
    console.debug('LOAD_PROVIDER_FAILURE', payload);
  },
  LOAD_BACKUP_PROVIDER_REQUEST() {
    console.debug('LOAD_BACKUP_PROVIDER_REQUEST');
  },
  LOAD_BACKUP_PROVIDER_SUCCESS(_state, payload) {
    console.debug('LOAD_BACKUP_PROVIDER_SUCCESS', payload);
  },
  LOAD_BACKUP_PROVIDER_FAILURE(_state, payload) {
    Vue.set(_state, 'injectedLoaded', false);
    Vue.set(_state, 'backUpLoaded', false);
    Vue.set(_state, 'account', null);
    Vue.set(_state, 'activeChainId', null);
    Vue.set(_state, 'active', false);
    console.debug('LOAD_BACKUP_PROVIDER_FAILURE', payload);
  },
  HANDLE_CHAIN_CHANGED() {
    console.debug('HANDLE_CHAIN_CHANGED');
  },
  HANDLE_ACCOUNTS_CHANGED(_state, payload) {
    Vue.set(_state, 'account', payload);
    console.debug('HANDLE_ACCOUNTS_CHANGED', payload);
  },
  HANDLE_CLOSE_CHANGED() {
    console.debug('HANDLE_CLOSE_CHANGED');
  },
  HANDLE_NETWORK_CHANGED() {
    console.debug('HANDLE_NETWORK_CHANGED');
  },
  LOOKUP_ADDRESS_REQUEST() {
    console.debug('LOOKUP_ADDRESS_REQUEST');
  },
  LOOKUP_ADDRESS_SUCCESS(_state, payload) {
    Vue.set(_state, 'name', payload);
    console.debug('LOOKUP_ADDRESS_SUCCESS');
  },
  LOOKUP_ADDRESS_FAILURE(_state, payload) {
    console.debug('LOOKUP_ADDRESS_FAILURE', payload);
  },
  RESOLVE_NAME_REQUEST() {
    console.debug('RESOLVE_NAME_REQUEST');
  },
  RESOLVE_NAME_SUCCESS() {
    console.debug('RESOLVE_NAME_SUCCESS');
  },
  RESOLVE_NAME_FAILURE(_state, payload) {
    console.debug('RESOLVE_NAME_FAILURE', payload);
  },
  SEND_TRANSACTION_REQUEST() {
    console.debug('SEND_TRANSACTION_REQUEST');
  },
  SEND_TRANSACTION_SUCCESS() {
    console.debug('SEND_TRANSACTION_SUCCESS');
  },
  SEND_TRANSACTION_FAILURE(_state, payload) {
    console.debug('SEND_TRANSACTION_FAILURE', payload);
  },
  GET_BALANCES_REQUEST() {
    console.debug('GET_BALANCES_REQUEST');
  },
  GET_BALANCES_SUCCESS(_state, payload) {
    for (const address in payload) {
      Vue.set(_state.balances, address, payload[address]);
    }
    console.debug('GET_BALANCES_SUCCESS');
  },
  GET_BALANCES_FAILURE(_state, payload) {
    console.debug('GET_BALANCES_FAILURE', payload);
  },
  GET_PROXY_REQUEST() {
    console.debug('GET_PROXY_REQUEST');
  },
  GET_PROXY_SUCCESS(_state, payload) {
    Vue.set(_state, 'dsProxyAddress', payload);
    console.debug('GET_PROXY_SUCCESS');
  },
  GET_PROXY_FAILURE(_state, payload) {
    console.debug('GET_PROXY_FAILURE', payload);
  },
  GET_PROXY_ALLOWANCE_REQUEST() {
    console.debug('GET_PROXY_ALLOWANCE_REQUEST');
  },
  GET_PROXY_ALLOWANCE_SUCCESS(_state, payload) {
    Vue.set(_state.proxyAllowances, payload.tokenAddress, payload.allowance);
    console.debug('GET_PROXY_ALLOWANCE_SUCCESS');
  },
  GET_PROXY_ALLOWANCE_FAILURE(_state, payload) {
    console.debug('GET_PROXY_ALLOWANCE_FAILURE', payload);
  }
};

const actions = {
  loadTokenMetadata: async ({ commit }, tokens) => {
    commit('LOAD_TOKEN_METADATA_REQUEST');
    const web3 = new ethers.providers.JsonRpcProvider(
      backupUrls[config.chainId]
    );
    const multi = new ethers.Contract(
      config.addresses.multicall,
      abi['Multicall'],
      web3
    );
    const calls = [];
    const testToken = new Interface(abi.TestToken);
    tokens.forEach(token => {
      // @ts-ignore
      calls.push([token, testToken.functions.decimals.encode([])]);
    });
    const tokenMetadata: any = {};
    try {
      const [, response] = await multi.aggregate(calls);
      let i = 0;
      response.forEach(value => {
        if (tokens && tokens[i]) {
          const tokenDecimals = testToken.functions.decimals.decode(value)[0];
          tokenMetadata[getAddress(tokens[i])] = {
            decimals: tokenDecimals
          };
        }
        i++;
      });
      commit('LOAD_TOKEN_METADATA_SUCCESS', tokenMetadata);
      return tokenMetadata;
    } catch (e) {
      commit('LOAD_TOKEN_METADATA_FAILURE', e);
      return Promise.reject();
    }
  },
  login: async ({ dispatch }, connector = 'injected') => {
    const options = config.connectors[connector].options || {};
    provider = await connectors[connector](options);
    if (provider) {
      web3 = new ethers.providers.Web3Provider(provider);
      await dispatch('loadWeb3');
    }
  },
  loadWeb3: async ({ commit, dispatch }) => {
    commit('LOAD_WEB3_REQUEST');
    try {
      await dispatch('loadProvider');
      await dispatch('loadAccount');
      commit('LOAD_WEB3_SUCCESS');
      if (!state.injectedLoaded || state.injectedChainId !== config.chainId) {
        await dispatch('loadBackupProvider');
      } else {
        /**
        this.providerStatus.activeChainId = this.providerStatus.injectedChainId;
        this.providerStatus.injectedActive = true;
        if (this.providerStatus.account)
          this.fetchUserBlockchainData(this.providerStatus.account);
        */
      }
    } catch (e) {
      commit('LOAD_WEB3_FAILURE', e);
      return Promise.reject();
    }
  },
  loadProvider: async ({ commit, dispatch }) => {
    commit('LOAD_PROVIDER_REQUEST');
    try {
      // @TODO Remove any old listeners
      if (provider.on) {
        provider.on('chainChanged', async () => {
          commit('HANDLE_CHAIN_CHANGED');
          if (state.active) {
            await dispatch('loadWeb3');
          }
        });
        provider.on('accountsChanged', async accounts => {
          if (accounts.length === 0) {
            if (state.active) await dispatch('loadWeb3');
          } else {
            commit('HANDLE_ACCOUNTS_CHANGED', accounts[0]);
            await dispatch('loadAccount');
          }
        });
        provider.on('close', async () => {
          commit('HANDLE_CLOSE');
          if (state.active) await dispatch('loadWeb3');
        });
        provider.on('networkChanged', async () => {
          commit('HANDLE_NETWORK_CHANGED');
          if (state.active) {
            await dispatch('loadWeb3');
          }
        });
      }
      const network = await web3.getNetwork();
      const accounts = await web3.listAccounts();
      const account = accounts.length > 0 ? accounts[0] : null;
      commit('LOAD_PROVIDER_SUCCESS', {
        injectedLoaded: true,
        injectedChainId: network.chainId,
        account,
        name
      });
    } catch (e) {
      commit('LOAD_PROVIDER_FAILURE', e);
      return Promise.reject();
    }
  },
  loadBackupProvider: async ({ commit }) => {
    try {
      const web3 = new ethers.providers.JsonRpcProvider(
        backupUrls[config.chainId]
      );
      const network = await web3.getNetwork();
      commit('LOAD_BACKUP_PROVIDER_SUCCESS', {
        injectedActive: false,
        backUpLoaded: true,
        account: null,
        activeChainId: network.chainId
        // backUpWeb3: web3,
      });
    } catch (e) {
      commit('LOAD_BACKUP_PROVIDER_FAILURE', e);
      return Promise.reject();
    }
  },
  lookupAddress: async ({ commit }) => {
    commit('LOOKUP_ADDRESS_REQUEST');
    try {
      const name = await web3.lookupAddress(state.account);
      commit('LOOKUP_ADDRESS_SUCCESS', name);
      return name;
    } catch (e) {
      commit('LOOKUP_ADDRESS_FAILURE', e);
    }
  },
  resolveName: async ({ commit }, payload) => {
    commit('RESOLVE_NAME_REQUEST');
    try {
      const address = await web3.resolveName(payload);
      commit('RESOLVE_NAME_SUCCESS');
      return address;
    } catch (e) {
      commit('RESOLVE_NAME_FAILURE', e);
      return Promise.reject();
    }
  },
  sendTransaction: async (
    { commit },
    [contractType, contractAddress, action, params, overrides]
  ) => {
    commit('SEND_TRANSACTION_REQUEST');
    try {
      const signer = web3.getSigner();
      const contract = new ethers.Contract(
        getAddress(contractAddress),
        abi[contractType],
        web3
      );
      const contractWithSigner = contract.connect(signer);
      const tx = await contractWithSigner[action](...params, overrides);
      await tx.wait();
      commit('SEND_TRANSACTION_SUCCESS');
      return tx;
    } catch (e) {
      commit('SEND_TRANSACTION_FAILURE', e);
      return Promise.reject();
    }
  },
  loadAccount: async ({ dispatch }) => {
    // @ts-ignore
    const tokens = Object.entries(config.tokens).map(token => token[1].address);
    await Promise.all([
      dispatch('lookupAddress'),
      dispatch('getBalances', tokens),
      dispatch('getMyPools'),
      dispatch('getMyPoolShares'),
      dispatch('getProxy')
    ]);
  },
  getBalances: async ({ commit }, tokens) => {
    commit('GET_BALANCES_REQUEST');
    const address = state.account;
    const promises: any = [];
    const multi = new ethers.Contract(
      config.addresses.multicall,
      abi['Multicall'],
      web3
    );
    const calls = [];
    const testToken = new Interface(abi.TestToken);
    tokens.forEach(token => {
      // @ts-ignore
      calls.push([token, testToken.functions.balanceOf.encode([address])]);
    });
    promises.push(multi.aggregate(calls));
    promises.push(multi.getEthBalance(address));
    const balances: any = {};
    try {
      // @ts-ignore
      const [[, response], ethBalance] = await Promise.all(promises);
      const ethBalanceNumber = new BigNumber(ethBalance as any);
      balances.ether = ethBalanceNumber.toString();
      let i = 0;
      response.forEach(value => {
        if (tokens && tokens[i]) {
          const tokenBalance = testToken.functions.balanceOf.decode(value);
          const tokenBalanceNumber = new BigNumber(tokenBalance);
          balances[getAddress(tokens[i])] = tokenBalanceNumber.toString();
        }
        i++;
      });
      commit('GET_BALANCES_SUCCESS', balances);
      return balances;
    } catch (e) {
      commit('GET_BALANCES_FAILURE', e);
      return Promise.reject();
    }
  },
  getProxy: async ({ commit }) => {
    commit('GET_PROXY_REQUEST');
    const address = state.account;
    try {
      const dsProxyRegistryContract = new ethers.Contract(
        config.addresses.dsProxyRegistry,
        abi['DSProxyRegistry'],
        web3
      );
      const proxy = await dsProxyRegistryContract.proxies(address);
      commit('GET_PROXY_SUCCESS', proxy);
      return proxy;
    } catch (e) {
      commit('GET_PROXY_FAILURE', e);
      return Promise.reject();
    }
  },
  getProxyAllowance: async ({ commit }, tokenAddress) => {
    commit('GET_PROXY_ALLOWANCE_REQUEST');
    const owner = state.account;
    const spender = state.dsProxyAddress;
    try {
      const tokenContract = new ethers.Contract(
        getAddress(tokenAddress),
        abi['TestToken'],
        web3
      );
      const allowance = parseFloat(
        formatEther(await tokenContract.allowance(owner, spender))
      );
      commit('GET_PROXY_ALLOWANCE_SUCCESS', {
        tokenAddress,
        owner,
        spender,
        allowance
      });
      return allowance;
    } catch (e) {
      commit('GET_PROXY_ALLOWANCE_FAILURE', e);
      return Promise.reject();
    }
  }
};

export default {
  state,
  getters,
  mutations,
  actions
};