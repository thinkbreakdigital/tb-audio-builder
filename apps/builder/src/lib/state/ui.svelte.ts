/**
 * Temporary UI state: not part of `BuilderProject`, never persisted, cleared on reload.
 */

export type MainView = 'channel-editor' | 'mixer-overview';
export type ChannelTab = 'instrument' | 'mixer';

let selectedChannelId = $state<string | null>(null);
let mainView = $state<MainView>('channel-editor');
let channelTab = $state<ChannelTab>('instrument');
let openDialog = $state<string | null>(null);

export const uiState = {
	get selectedChannelId(): string | null {
		return selectedChannelId;
	},
	get mainView(): MainView {
		return mainView;
	},
	get channelTab(): ChannelTab {
		return channelTab;
	},
	get openDialog(): string | null {
		return openDialog;
	},

	setSelectedChannelId(channelId: string | null): void {
		selectedChannelId = channelId;
	},

	setMainView(view: MainView): void {
		mainView = view;
	},

	setChannelTab(tab: ChannelTab): void {
		channelTab = tab;
	},

	setOpenDialog(dialogId: string | null): void {
		openDialog = dialogId;
	}
};
