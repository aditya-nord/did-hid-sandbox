<template>
	<v-row justify="center" align="center">
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
					</div>
				</v-card-text>
			</v-card>
		</v-col>
	</v-row>
</template>

<script>
import { mapState } from 'vuex'
import { getEthersSigner, ldToJsonConvertor } from '../utils/index'

export default {
	name: 'DidPage',
	computed: {
		...mapState(['walletAddress', 'didDocument']),
	},
	data() {
		return {
			walletConnected: false,
			valid: true,
		}
	},
	methods: {
		async connectWallet() {
			await this.$store.dispatch('connectWallet')
			if (this.$store.state.walletAddress !== '') {
				this.walletConnected = true
			}
		},
		async signTheMessage(didDoc) {
			const signer = await getEthersSigner()
			if (signer.success) {
				console.error('Something went wrong')
				return
			}
			const signedMessage = signer.signer.signMessage(didDoc)
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
				if (await this.$store.dispatch('addNewWallet')) {
					const signedMessage = await this.signTheMessage(
						JSON.stringify(
							ldToJsonConvertor(this.$store.state.didDocument)
						)
					)
					this.$store.commit('pushNewWalletSignature', {
						walletAddress: this.$store.state.walletAddress,
						signature: signedMessage,
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
				const signedMessage = await this.signTheMessage(
					JSON.stringify(
						ldToJsonConvertor(this.$store.state.didDocument)
					)
				)
				const vmId = this.didDocument.verificationMethod.find((x) =>
					x.id.includes(this.walletAddress) ? x.id : undefined
				)
				console.log(vmId)
				const updateDIDPayload = {
					verificationMethodId: vmId.id,
					signature: signedMessage,
					didDocument: this.$store.state.didDocument,
					walletAddOnSignatures:
						this.$store.state.walletAddOnSignatures,
				}
				await this.$store.dispatch('updateDID', updateDIDPayload)
			} catch (error) {
				console.error(error)
			}
		},
	},
}
</script>
