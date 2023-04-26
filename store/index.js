import { ethers } from 'ethers'
import { getEthersProvider, ldToJsonConvertor, NETWORK, toHex } from '../utils/index'

export const state = () => ({
	walletAddress: '',
	walletConnected: false,
	didDocument: {},
	didResolved: false,
	didRegistered: false,
	did: '',
	walletAddOnSignatures: [],
	signInfos: [],
})

export const getters = {
	getDIDDocJSONString: (state) => {
		return JSON.stringify(ldToJsonConvertor(state.didDocument), (key, value) => {
			if (value === "" || (Array.isArray(value) && value.length === 0)) {
				return undefined;
			}
			return value;
		})
	},
}

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
		// const vmId = `${controller}#key-${state.didDocument.verificationMethod.length + 1
		// 	}`
		const newVmId = `did:hid:testnet:${state.walletAddress}#key-${state.didDocument.verificationMethod.length + 1}`


		const verificationMethodObj = {
			id: newVmId,
			type: 'EcdsaSecp256k1RecoveryMethod2020',
			controller: controller,
			blockchainAccountId: blockchainId,
			publicKeyMultibase: ""
		}

		console.log('Verification Method Object')
		console.log(verificationMethodObj)

		state.didDocument.verificationMethod.push(verificationMethodObj)
		state.didDocument.authentication.push(newVmId)
		state.didDocument.assertionMethod.push(newVmId)
	},
	pushNewWalletSignature(state, payload) {
		const { walletAddress, signature, message, verification_method_id } = payload
		const blockchainId = `eip155:${NETWORK}:${walletAddress}`

		// verification_method_id: "", // did:hid:testnet:0xB08138Cb5F6Ac6b908F0F70B72F8092EAe12a9cd#key-1
		// 			signature: "",
		// 			clientSpec: {
		// 				type: "eth-personalSign",
		// 				adr036SignerAddress: ""
		// 			}
		state.walletAddOnSignatures.push({
			walletAddress,
			signature,
			message,
		})
		if(state.signInfos.findIndex((v) => v.verification_method_id == verification_method_id) == -1) {

			state.signInfos.push({
				verification_method_id,
				signature,
				clientSpec: {
					type: "eth-personalSign",
					adr036SignerAddress: ""
				}
			})
		}
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
				Object.keys(data.data.didDocument).length == 0 ||
				data.data.didDocumentMetadata == null
			) {
				return false
			} else {
				const didDocument = data.data.didDocument
				commit('setDidDocument', { didDocument })
				commit('setDid', { did: data.data.didDocument.id })
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
				Object.keys(data.data.metaData.didDocument).length == 0 &&
				data.data.did.length == 0
			) {
				return false
			} else {
				const didDocument = data.data.metaData.didDocument
				commit('setDidDocument', { didDocument })
				commit('setDid', { did: data.data.did })
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
			// const newWalletDidId = `${state.did}#key-${state.didDocument.verificationMethod.length + 1}`
			const vmId = `did:hid:testnet:${state.walletAddress}#key-${state.didDocument.verificationMethod.length + 1}`
			await commit('upsertNewVerificationMethodToDidDocument', {
				blockchainId,
			})

			return { status: true, data: vmId }
		} catch (error) {
			console.error(error)
		}
		return { status: false, data: null }
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
			// const didDoc = data.data.didDoc
			// commit('setDidDocument', { didDocument: didDoc })
			return true
		} catch (error) {
			console.error(error)
		}
		return false
	},
}
