<template>
	<v-row justify="center">
		<v-col cols="12" sm="8" md="6">
			<v-card style="text-align: center">
				<v-card-title class="headline">
					Sandbox App to test HID
				</v-card-title>
				<v-card-text class="mt-5">
					<div style="text-align: center" v-if="!walletConnected">
						<v-btn
							class="mt-15"
							@click="connectWallet"
							color="primary"
						>
							Connect Wallet
						</v-btn>
					</div>
					<div v-else>
						<h3>You are now connected with {{ walletAddress }}</h3>
						<br />
						<h4>Addresses:</h4>
						<div
							class="event-card"
							v-for="vMethod in didDocument.verificationMethod"
							:key="vMethod.id"
						>
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
					<v-btn
						class="mt-15"
						@click="beginAddNewWallet"
						color="primary"
					>
						Add Wallet
					</v-btn>
					<br />
					<v-btn
						class="mt-15"
						@click="saveAndUpdateDID"
						color="primary"
					>
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

						<v-btn
							color="green darken-1"
							text
							@click="dialog = false"
						>
							Close
						</v-btn>
					</v-card-actions>
				</v-card>
			</v-dialog>
			<v-dialog v-model="walletSwitchDialog" max-width="720">
				<v-card>
					<v-card-title class="text-h5"> Switch Wallet </v-card-title>
					<v-card-text>
						<h2>Switch your wallet to continue</h2>
					</v-card-text>
				</v-card>
			</v-dialog>
		</v-col>
	</v-row>
</template>

<script>
import { mapState } from 'vuex'
import {
	getEthersProvider,
	ldToJsonConvertor,
	closeWalletConnection,
	verifyMessage,
} from '../utils/index'

export default {
	name: 'DidPage',
	computed: {
		...mapState(['walletAddress', 'didDocument']),
	},
	data() {
		return {
			walletConnected: false,
			valid: true,
			dialog: false,
			walletSwitchDialog: false,
		}
	},
	methods: {
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

		async connectWallet() {
			await this.$store.dispatch('connectWallet')
			if (this.$store.state.walletAddress !== '') {
				this.walletConnected = true
			}
			this.attemptToResolve()
		},
		async switchWallet() {
			this.walletSwitchDialog = true
			setTimeout(() => {
				this.walletSwitchDialog = false
			}, 2000)
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
		// disconnect and allow to reconnect
		async attemptToResolve() {
			//Try to resolve the connected wallet
			// If resolved, show document otherwise begin register process
			try {
				if (await this.$store.dispatch('resolveDID')) {
					console.log('Resolved DID')
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
		async beginAddNewWallet() {
			try {
				// disconnect
				// show modal with message to switch to new wallet
				await this.switchWallet()
				// TODO: Should check if the connected wallet resolves to a DID, continue only if it doesn't
				if (await this.$store.dispatch('addNewWallet')) {
					const message = JSON.stringify(
						ldToJsonConvertor(this.$store.state.didDocument)
					)
					const signedMessage = await this.signTheMessage(message)
					this.$store.commit('pushNewWalletSignature', {
						walletAddress: this.$store.state.walletAddress,
						signature: signedMessage,
						message,
					})
				}
			} catch (error) {
				console.error(error)
			}
		},
		async saveAndUpdateDID() {
			try {
				// disconnect
				// show modal with message to switch to controller wallet
				await this.switchWallet()
				const signedMessage = await this.signTheMessage(
					JSON.stringify(
						ldToJsonConvertor(this.$store.state.didDocument)
					)
				)
				// verificationMethodId: JSON.parse(message).verificationMethod.find(x => x.blockchainAccountId.includes(this.walletAddressEdit.address)).id,
				const vmId = this.didDocument.verificationMethod.find((x) =>
					x.blockchainAccountId.includes(
						this.$store.state.walletAddOnSignatures[0].walletAddress
					)
				).id
				console.log(vmId)
				const updateDIDPayload = {
					verificationMethodId: vmId,
					signature: signedMessage,
					didDocument: this.$store.state.didDocument,
					// walletAddOnSignatures:
					// 	this.$store.state.walletAddOnSignatures,
				}
				await verifyMessage({
					message: JSON.stringify(
						ldToJsonConvertor(this.$store.state.didDocument)
					),
					address: this.$store.state.walletAddress,
					signature: signedMessage,
				})
				await this.$store.dispatch('updateDID', updateDIDPayload)
			} catch (error) {
				console.error(error)
			}
		},
	},
}
</script>
