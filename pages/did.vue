<template>
	<v-row justify="center">
		<v-col cols="12" sm="8" md="6">
			<v-card style="text-align: center">
				<v-card-title class="headline">
					Sandbox App to test HID
				</v-card-title>
				<v-card-text class="mt-5">
					<div style="text-align: center" v-if="!walletConnected">
						<v-btn class="mt-15" @click="connectWallet" color="primary">
							Connect Wallet
						</v-btn>
					</div>
					<div v-else>
						<h3>You are now connected with {{ walletAddress }}</h3>
						<br />
						<h4>Addresses:</h4>
						<div class="event-card" v-for="vMethod in didDocument.verificationMethod" :key="vMethod.id">
							<div class="centered card-title">
								<label>{{
									parseBlockchainAccountId(
										vMethod.blockchainAccountId
									).walletAddress
								}}</label>
							</div>
						</div>
						<br />

						<v-btn color="primary" dark @click.stop="dialog = true">
							View DID
						</v-btn>
					</div>
				</v-card-text>
			</v-card>
			<v-card style="text-align: center" v-if="walletConnected">
				<v-card-title class="headline"> Actions on DID </v-card-title>
				<v-card-text class="mt-5">
					<v-btn class="mt-15" @click="beginAddNewWallet" color="primary">
						Add Wallet
					</v-btn>
					<br />
					<v-btn class="mt-15" @click="save" color="primary">
						Save Changes
					</v-btn>
				</v-card-text>
			</v-card>
			<v-dialog v-model="dialog" max-width="720">
				<v-card>
					<v-card-title class="text-h5"> DID DOCUMENT </v-card-title>

					<v-card-text>
						{{ didDocument }}
					</v-card-text>

					<v-card-actions>
						<v-spacer></v-spacer>

						<v-btn color="green darken-1" text @click="dialog = false">
							Close
						</v-btn>
					</v-card-actions>
				</v-card>
			</v-dialog>
			<v-dialog v-model="walletSwitchDialog" max-width="720">
				<v-card>
					<v-card-title class="text-h5"> Switch Wallet </v-card-title>
					<v-card-text>
						<h2>Switch your wallet to continue. <span v-if="errorAlertDialogue">{{ errorAlertMsg }}</span></h2>
					</v-card-text>
				</v-card>
			</v-dialog>
		</v-col>
		<v-snackbar v-model="snackbar" :timeout="timeout">
			{{ snackbarText }}

			<template v-slot:action="{ attrs }">
				<v-btn color="blue" text v-bind="attrs" @click="snackbar = false">
					Close
				</v-btn>
			</template>
		</v-snackbar>
	</v-row>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import {
	getEthersProvider,
	ldToJsonConvertor,
	closeWalletConnection,
	verifyMessage,
} from '../utils/index'

export default {
	name: 'DidPage',
	computed: {
		...mapState(['walletAddress', 'didDocument', 'unregisteredVerificationMethods']),
		...mapGetters(['getDIDDocJSONString']),

	},
	data() {
		return {
			walletConnected: false,
			valid: true,
			dialog: false,
			walletSwitchDialog: false,
			errorAlertDialogue: false,
			errorAlertMsg: "",
			snackbar: false,
			snackbarText: "",
			timeout: 2000,
		}
	},
	methods: {
		// Util functions
		parseBlockchainAccountId(bId) {
			if (bId) {
				const bIds = bId.split(':')
				console.log(bIds)
				return {
					walletAddress: bIds[2],
					chainId: bIds[1],
				}
			}
		},

		// Function called internally within the page
		async switchWallet() {
			this.walletSwitchDialog = true
			setTimeout(() => {
				this.walletSwitchDialog = false
			}, 3000)
			await closeWalletConnection()
			this.$store.commit('clearAddress')
			await this.$store.dispatch('connectWallet')
			if (this.$store.state.walletAddress !== '') {
				this.walletConnected = true
			}
			return
		},
		async signTheMessage(didDoc) {
			const provider = await getEthersProvider()
			if (!provider.success) {
				console.error('Something went wrong')
				return
			}
			const signer = provider.provider.getSigner()
			const signedMessage = signer.signMessage(didDoc)
			return signedMessage
		},
		async attemptToResolve() {
			//Try to resolve the connected wallet
			// If resolved, show document otherwise begin register process
			try {
				if (await this.$store.dispatch('resolveDID')) {
					console.log('Resolved DID')
					this.registeredVMs = this.didDocument.verificationMethod;
				} else {
					this.beginCreateAndRegister()
				}
			} catch (error) {
				console.error(error)
			}
		},
		async beginCreateAndRegister() {
			try {
				await this.$store.dispatch('createDID')
				const signedMessage = await this.signTheMessage(
					JSON.stringify(
						ldToJsonConvertor(this.$store.state.didDocument)
					)
				)
				const vmId = this.didDocument.verificationMethod.find((x) =>
					x.id.includes(this.walletAddress) ? x.id : undefined
				)
				console.log(vmId)
				const registerDIDPayload = {
					verificationMethodId: vmId.id,
					signature: signedMessage,
					didDocument: this.$store.state.didDocument,
				}
				await this.$store.dispatch('registerDID', registerDIDPayload)
			} catch (error) {
				console.error(error)
			}
		},
		async getWalletSignature(address) {
			try {
				while (this.$store.state.walletAddress.toLowerCase() != address.toLowerCase()) {
					this.errorAlertDialogue = true
					this.errorAlertMsg = `Please connect with the ${address} to continue.`
					await this.switchWallet()
				}
				this.errorAlertDialogue = true
				const verificationMethodId = this.didDocument.verificationMethod.filter(x => x.id.includes(address))[0].id;
				console.log({ verificationMethodId })
				const signedMessage = await this.signTheMessage(
					this.getDIDDocJSONString
				)
				await verifyMessage({
					message: this.getDIDDocJSONString,
					address: this.$store.state.walletAddress,
					signature: signedMessage,
				})
				return {
					status: true, data: {
						verification_method_id: verificationMethodId,
						signature: signedMessage,
						clientSpec: {
							type: "eth-personalSign",
							adr036SignerAddress: ""
						}
					}
				}
			} catch (error) {
				console.error(error)
				return { status: false, data: null }
			}
		},

		// Functions called upon an event such as button click
		async connectWallet() {
			await this.$store.dispatch('connectWallet')
			if (this.$store.state.walletAddress !== '') {
				this.walletConnected = true
			}
			this.attemptToResolve()
		},
		async beginAddNewWallet() {
			try {
				await this.switchWallet()
				const newWalletDidId = await this.$store.dispatch('addNewWallet');
				console.log(newWalletDidId)
			} catch (error) {
				console.error(error)
			}
		},
		async saveAndUpdateDID() {
			try {
				console.log({new: this.didDocument.verificationMethod, old: this.unregisteredVerificationMethods})
				const newVerificationMethods = this.didDocument.verificationMethod.filter(x => this.unregisteredVerificationMethods.findIndex(y => y == x.id) == -1 ? false : true)
				console.log({ newVerificationMethods })

				if (newVerificationMethods.length == 0) {
					this.snackbarText = "No new wallets added for the DID Doc to be updated.";
					this.snackbar = true;
					return
				}

				const signInfos = [];

				for (let i = 0; i < newVerificationMethods.length; i++) {
					const vm = newVerificationMethods[i];
					const address = vm.blockchainAccountId.split(':')[2];
					const walletSignature = await this.getWalletSignature(address);
					if (!walletSignature.status) {
						this.snackbarText = "Could not record the wallet signature, please try again.";
						this.snackbar = true;
						return;
					}
					signInfos.push(walletSignature.data)
				}

				const controllerWalletVm = this.didDocument.verificationMethod.filter(x => x.id.includes('key-1'))[0];
				const controllerWalletAddress = controllerWalletVm.blockchainAccountId.split(':')[2]
				const controllerSignature = await this.getWalletSignature(controllerWalletAddress)

				if (!controllerSignature.status) {
					this.snackbarText = "Could not record the controller signature, please try again.";
					this.snackbar = true;
					return;
				}
				signInfos.push(controllerSignature.data)

				const updateDIDPayload = {
					didDocument: ldToJsonConvertor(JSON.parse(this.getDIDDocJSONString)),
					signInfos
				}
				await this.$store.dispatch('updateDID', updateDIDPayload)
			} catch (error) {
				console.error(error)
			}
		},
	},
}
</script>
