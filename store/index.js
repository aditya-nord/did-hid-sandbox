import { ethers } from 'ethers'
import { getEthersProvider, NETWORK, toHex } from '../utils/index'

export const state = () => ({
	walletAddress: '',
	walletConnected: false,
	didDocument: {},
	didResolved: false,
	didRegistered: false,
	did: '',
	walletAddOnSignatures: [],
})

export const mutations = {
	setAddress(state, payload) {
		state.walletAddress = payload.walletAddress
		state.walletConnected = payload.walletConnected
	},
	setDidDocument(state, payload) {
		state.didDocument = payload.didDocument
	},
	setFlagsAfterRegisterOrResolve(state) {
		state.didResolved = true
		state.didRegistered = true
	},
	upsertNewVerificationMethodToDidDocument(state, payload) {
		const { blockchainId } = payload

		const t = state.didDocument.verificationMethod.find(
			(x) => x.blockchainAccountId === blockchainId
		)
		if (t) {
			throw new Error(
				'Wallet Address already added in the didDoc, choose different one'
			)
		}

		const controller = state.did
		const vmId = `${controller}#key-${
			state.didDocument.verificationMethod.length + 1
		}`

		state.didDocument.verificationMethod.push({
			id: vmId,
			type: 'EcdsaSecp256k1RecoveryMethod2020',
			controller: controller,
			blockchainAccountId: blockchainId,
		})
		state.didDocument.authentication.push(vmId)
		state.didDocument.assertionMethod.push(vmId)
	},
	pushNewWalletSignature(state, payload) {
		const { walletAddress, signature } = payload
		state.walletAddOnSignatures.push({
			walletAddress,
			signature,
		})
	},
	clearAddress(state) {
		state.walletAddress = ''
		state.walletConnected = false
	},
}

export const actions = {
	async connectWallet({ commit, dispatch }) {
		try {
			dispatch('getIP')
			const { success, provider, address } = await getEthersProvider()
			if (!success || provider == null) {
				throw new Error('Provider not found')
			}
			commit('setAddress', {
				walletAddress: address,
				walletConnected: true,
			})
			return true
		} catch (error) {
			console.error(error)
			return false
		}
	},
	async resolveDID({ state, commit, dispatch }) {
		const payload = {
			walletAddress: state.walletAddress,
			chainId: toHex(NETWORK),
		}
		// let didId = `did:hid:testnet:${this.walletAddress}`
		try {
			const data = await this.$axios.$post(
				'http://localhost:1555/v1/did/resolve',
				payload
			)
			console.log(data)
			const didDoc = data.data.didDoc
			commit('setDidDocument', { didDocument: didDoc })
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
	async createDID({ state, commit, dispatch }) {
		const payload = {
			walletAddress: state.walletAddress,
			chainId: toHex(NETWORK),
		}
		try {
			const data = await this.$axios.$post(
				'http://localhost:1555/v1/did/create',
				payload
			)
			console.log(data)
			const didDoc = data.data.didDoc
			commit('setDidDocument', { didDocument: didDoc })
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
	async registerDID({ commit }, payload) {
		try {
			// Resolve first to ensure not already registered
			// Must verify signature once
			const data = await this.$axios.$post(
				'http://localhost:1555/v1/did/register',
				payload
			)
			console.log(data)
			const didDoc = data.data.didDoc
			commit('setFlagsAfterRegisterOrResolve')
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
	async addNewWallet({ state, commit }) {
		const blockchainId = `eip155:${NETWORK}:${state.walletAddress}`
		try {
			await commit('upsertNewVerificationMethodToDidDocument', {
				blockchainId,
			})
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
	async updateDID({ commit }, payload) {
		try {
			// Resolve first to ensure already registered
			// Must verify the signatures on the backend
			const data = await this.$axios.$post(
				'http://localhost:1555/v1/did/update',
				payload
			)
			console.log(data)
			const didDoc = data.data.didDoc
			commit('setDidDocument', { didDocument: didDoc })
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
}
