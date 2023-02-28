import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { ethers } from 'ethers'

export const NETWORK = 1

export const truncateAddress = (address) => {
	if (!address) return 'No Account'
	const match = address.match(
		/^(0x[a-zA-Z0-9]{2})[a-zA-Z0-9]+([a-zA-Z0-9]{2})$/
	)
	if (!match) return address
	return `${match[1]}…${match[2]}`
}

export const toHex = (num) => {
	const val = Number(num)
	return '0x' + val.toString(16)
}

export const getEthersProvider = async () => {
	try {
		const providerOptions = {
			walletconnect: {
				package: WalletConnectProvider, // required
				options: {
					infuraId: 'e455e5fdffb8463295a0f641346994d8', // required
				},
			},
		}
		const web3Modal = new Web3Modal({
			cacheProvider: false, // optional
			providerOptions, // required
		})
		const ethereumProvider = await web3Modal.connect()
		const provider = new ethers.providers.Web3Provider(ethereumProvider)
		const accounts = await provider.listAccounts()
		const chainId = (await provider.getNetwork()).chainId
		console.log('chainId ', chainId)
		if (chainId != 1) {
			try {
				await provider.provider.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: toHex(NETWORK) }],
				})
			} catch (switchError) {
				if (switchError.code === 4902) {
					try {
						await provider.provider.request({
							method: 'wallet_addEthereumChain',
							params: [networkParams[toHex(NETWORK)]],
						})
					} catch (error) {
						console.error(error)
					}
				}
			}
		}

		return {
			success: true,
			address: accounts[0],
			provider,
		}
	} catch (error) {
		console.error(error)
		return {
			success: false,
			address: '',
			provider: null,
		}
	}
}

export const getEthersSigner = async () => {
	try {
		const providerOptions = {
			walletconnect: {
				package: WalletConnectProvider, // required
				options: {
					infuraId: 'e455e5fdffb8463295a0f641346994d8', // required
				},
			},
		}
		const web3Modal = new Web3Modal({
			cacheProvider: false, // optional
			providerOptions, // required
		})
		const ethereumProvider = await web3Modal.connect()
		const provider = new ethers.providers.Web3Provider(ethereumProvider)
		const accounts = await provider.listAccounts()
		const chainId = (await provider.getNetwork()).chainId
		console.log('chainId ', chainId)
		if (chainId != 1) {
			try {
				await provider.provider.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: toHex(NETWORK) }],
				})
			} catch (switchError) {
				if (switchError.code === 4902) {
					try {
						await provider.provider.request({
							method: 'wallet_addEthereumChain',
							params: [networkParams[toHex(NETWORK)]],
						})
					} catch (error) {
						console.error(error)
					}
				}
			}
		}

		return {
			success: true,
			address: accounts[0],
			signer: provider.getSigner(),
		}
	} catch (error) {
		console.error(error)
		return {
			success: false,
			address: '',
			signer: null,
		}
	}
}

export const ldToJsonConvertor = (ld) => {
	const json = {}
	for (const key in ld) {
		if (key === '@context') {
			json['context'] = ld[key]
		} else if (
			ld[key] === '' ||
			(Array.isArray(ld[key]) && ld[key].length === 0)
		) {
			json[key] = undefined
		} else {
			json[key] = ld[key]
		}
	}
	return json
}

export const verifyMessage = async ({ message, address, signature }) => {
	try {
		const signerAddress = ethers.utils.verifyMessage(message, signature)
		if (signerAddress !== address) {
			return false
		}
		return true
	} catch (err) {
		console.log(err)
		return false
	}
}
