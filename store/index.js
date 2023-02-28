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
	setDid(state, payload) {
		state.did = payload.did
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

		const verificationMethodObj = {
			id: vmId,
			type: 'EcdsaSecp256k1RecoveryMethod2020',
			controller: controller,
			blockchainAccountId: blockchainId,
		}

		console.log('Verification Method Object')
		console.log(verificationMethodObj)

		state.didDocument.verificationMethod.push(verificationMethodObj)
		state.didDocument.authentication.push(vmId)
		state.didDocument.assertionMethod.push(vmId)
	},
	pushNewWalletSignature(state, payload) {
		const { walletAddress, signature, message } = payload
		state.walletAddOnSignatures.push({
			walletAddress,
			signature,
			message,
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
		}
		// let didId = `did:hid:testnet:${this.walletAddress}`
		try {
			const data = await this.$axios.$post(
				'http://localhost:1450/v1/did/resolve',
				payload
			)
			console.log(data)
			if (
				Object.keys(data.didDocument).length == 0 ||
				data.didDocumentMetadata == null
			) {
				return false
			} else {
				const didDocument = data.didDocument
				commit('setDidDocument', { didDocument })
				commit('setDid', { did: data.didDocument.id })
				return true
			}
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
				'http://localhost:1450/v1/did/create',
				payload
			)
			console.log(data)
			if (
				Object.keys(data.metaData.didDocument).length == 0 &&
				data.did.length == 0
			) {
				return false
			} else {
				const didDocument = data.metaData.didDocument
				commit('setDidDocument', { didDocument })
				commit('setDid', { did: data.did })
				return true
			}
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
				'http://localhost:1450/v1/did/register',
				payload
			)
			console.log(data)
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
			console.log(payload)
			const data = await this.$axios.$patch(
				'http://localhost:1450/v1/did/update',
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
