/**
 * @name BetterFriendList
 * @author DevilBro
 * @authorId 278543574059057154
 * @version 1.5.2
 * @description Adds extra Controls to the Friends Page, for example sort by Name/Status, Search and All/Request/Blocked Amount
 * @invite Jx3TjNS
 * @donate https://www.paypal.me/MircoWittrien
 * @patreon https://www.patreon.com/MircoWittrien
 * @website https://mwittrien.github.io/
 * @source https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/BetterFriendList/
 * @updateUrl https://mwittrien.github.io/BetterDiscordAddons/Plugins/BetterFriendList/BetterFriendList.plugin.js
 */

module.exports = (_ => {
	const changeLog = {
		
	};

	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		constructor (meta) {for (let key in meta) this[key] = meta[key];}
		getName () {return this.name;}
		getAuthor () {return this.author;}
		getVersion () {return this.version;}
		getDescription () {return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`;}
		
		downloadLibrary () {
			require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
				if (!e && b && r.statusCode == 200) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.showToast("Finished downloading BDFDB Library", {type: "success"}));
				else BdApi.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
			});
		}
		
		load () {
			if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
			if (!window.BDFDB_Global.downloadModal) {
				window.BDFDB_Global.downloadModal = true;
				BdApi.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
					confirmText: "Download Now",
					cancelText: "Cancel",
					onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
					onConfirm: _ => {
						delete window.BDFDB_Global.downloadModal;
						this.downloadLibrary();
					}
				});
			}
			if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
		}
		start () {this.load();}
		stop () {}
		getSettingsPanel () {
			let template = document.createElement("template");
			template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
			template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
			return template.content.firstElementChild;
		}
	} : (([Plugin, BDFDB]) => {
		var rerenderTimeout, sortKey, sortReversed;
		
		const favorizedFriendsSection = "FAVORIZED_FRIENDS";
		const hiddenFriendsSection = "HIDDEN_FRIENDS";
		const placeHolderId = "PLACEHOLDER_BETTERFRIENDLIST";
		
		var favorizedFriends = [], hiddenFriends = [];
		var currentSection, isFavoritesSelected = false, isHiddenSelected = false;
		
		const statusSortOrder = {
			online: 0,
			streaming: 1,
			idle: 2,
			dnd: 3,
			offline: 4,
			invisible: 5,
			unknown: 6
		};
		
		return class BetterFriendList extends Plugin {
			onLoad () {
				this.defaults = {
					general: {
						addTotalAmount:			{value: true, 	description: "Adds total Amount for All/Requested/Blocked"},
						addFavorizedCategory:	{value: true, 	description: "Adds Favorites Category"},
						addHiddenCategory:		{value: true, 	description: "Adds Hidden Category"},
						addSortOptions:			{value: true, 	description: "Adds Sort Options"},
						addMutualGuild:			{value: true, 	description: "Adds mutual Servers in Friend List"}
					}
				};

				this.modulePatches = {
					before: [
						"AnalyticsContext",
						"PeopleListSectionedLazy",
						"PeopleListSectionedNonLazy",
						"TabBar"
					],
					after: [
						"PeopleListItem",
						"TabBar"
					],
					componentDidMount: [
						"PeopleListItem"
					],
					componentWillUnmount: [
						"PeopleListItem"
					]
				};
				
				this.css = `
					${BDFDB.dotCNS.peoplestabbar + BDFDB.dotCN.peoplesbadge} {
						background-color: var(--background-accent);
						margin-left: 6px;
					}
					${BDFDB.dotCN._betterfriendlisttitle} {
						width: 200px;
					}
					${BDFDB.dotCN._betterfriendlistnamecell} {
						width: 200px;
					}
					${BDFDB.dotCN.peoplesuser} {
						flex: 1 1 auto;
					}
					${BDFDB.dotCN.peoplesactions} {
						flex: 0 0 auto;
					}
					${BDFDB.dotCN._betterfriendlistmutualguilds} {
						flex: 0 0 200px;
						margin-left: 13px;
					}
				`;
			}
			
			onStart () {
				sortKey = null;
				sortReversed = false;
				isFavoritesSelected = false;
				isHiddenSelected = false;

				this.forceUpdateAll();
			}
			
			onStop () {
				this.forceUpdateAll();
			}

			getSettingsPanel (collapseStates = {}) {
				let settingsPanel;
				return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, {
					collapseStates: collapseStates,
					children: _ => {
						let settingsItems = [];
				
						for (let key in this.defaults.general) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
							type: "Switch",
							plugin: this,
							keys: ["general", key],
							label: this.defaults.general[key].description,
							value: this.settings.general[key]
						}));
						
						return settingsItems;
					}
				});
			}

			onSettingsClosed () {
				if (this.SettingsUpdated) {
					delete this.SettingsUpdated;
					this.forceUpdateAll();
				}
			}
		
			forceUpdateAll () {
				favorizedFriends = BDFDB.DataUtils.load(this, "favorizedFriends");
				favorizedFriends = !BDFDB.ArrayUtils.is(favorizedFriends) ? [] : favorizedFriends;
				hiddenFriends = BDFDB.DataUtils.load(this, "hiddenFriends");
				hiddenFriends = !BDFDB.ArrayUtils.is(hiddenFriends) ? [] : hiddenFriends;
				
				BDFDB.PatchUtils.forceAllUpdates(this);
				this.rerenderList();
			}
			
			onUserContextMenu (e) {
				if (!e.instance.props.user || !BDFDB.LibraryStores.RelationshipStore.isFriend(e.instance.props.user.id)) return;
				let favorized = favorizedFriends.indexOf(e.instance.props.user.id) > -1;
				let hidden = hiddenFriends.indexOf(e.instance.props.user.id) > -1;
				let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, {id: "remove-friend"});
				if (index > -1) children.splice(index + 1, 0, this.settings.general.addFavorizedCategory && BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
					label: favorized ? this.labels.context_unfavorizefriend : this.labels.context_favorizefriend,
					id: BDFDB.ContextMenuUtils.createItemId(this.name, favorized ? "unfavorize-friend" : "favorize-friend"),
					action: _ => {
						if (favorized) BDFDB.ArrayUtils.remove(favorizedFriends, e.instance.props.user.id, true);
						else {
							favorizedFriends.push(e.instance.props.user.id);
							BDFDB.ArrayUtils.remove(hiddenFriends, e.instance.props.user.id, true);
						}
						BDFDB.DataUtils.save(favorizedFriends, this, "favorizedFriends");
						BDFDB.DataUtils.save(hiddenFriends, this, "hiddenFriends");
						this.rerenderList();
					}
				}), this.settings.general.addHiddenCategory && BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
					label: hidden ? this.labels.context_unhidefriend : this.labels.context_hidefriend,
					id: BDFDB.ContextMenuUtils.createItemId(this.name, hidden ? "unhide-friend" : "hide-friend"),
					action: _ => {
						if (hidden) BDFDB.ArrayUtils.remove(hiddenFriends, e.instance.props.user.id, true);
						else {
							BDFDB.ArrayUtils.remove(favorizedFriends, e.instance.props.user.id, true);
							hiddenFriends.push(e.instance.props.user.id);
						}
						BDFDB.DataUtils.save(favorizedFriends, this, "favorizedFriends");
						BDFDB.DataUtils.save(hiddenFriends, this, "hiddenFriends");
						this.rerenderList();
					}
				}));
			}
			
			processTabBar (e) {
				if (e.instance.props.children && e.instance.props.children.some(c => c && c.props.id == BDFDB.DiscordConstants.FriendsSections.ADD_FRIEND)) {
					currentSection = e.instance.props.selectedItem;
					isFavoritesSelected = currentSection == favorizedFriendsSection;
					isHiddenSelected = currentSection == hiddenFriendsSection;
					if (!e.returnvalue) {
						e.instance.props.children = e.instance.props.children.filter(c => c && c.props.id != favorizedFriendsSection && c.props.id != hiddenFriendsSection);
						if (this.settings.general.addFavorizedCategory) e.instance.props.children.splice(e.instance.props.children.findIndex(c => c && c.props.id == BDFDB.DiscordConstants.FriendsSections.ONLINE) + 1, 0, BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TabBar.Item, {
							id: favorizedFriendsSection,
							className: BDFDB.disCN.peoplestabbaritem,
							children: this.labels.favorites
						}));
						if (this.settings.general.addHiddenCategory) e.instance.props.children.splice(e.instance.props.children.findIndex(c => c && c.props.id == BDFDB.DiscordConstants.FriendsSections.BLOCKED) + 1, 0, BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TabBar.Item, {
							id: hiddenFriendsSection,
							className: BDFDB.disCN.peoplestabbaritem,
							children: this.labels.hidden
						}));
					}
					else {
						if (this.settings.general.addTotalAmount) {
							let relationships = BDFDB.LibraryStores.RelationshipStore.getRelationships(), relationshipCount = {};
							for (let type in BDFDB.DiscordConstants.RelationshipTypes) relationshipCount[type] = 0;
							for (let id in relationships) if (!this.settings.general.addHiddenCategory || (hiddenFriends.indexOf(id) == -1 || relationships[id] != BDFDB.DiscordConstants.RelationshipTypes.FRIEND)) relationshipCount[relationships[id]]++;
							for (let child of e.returnvalue.props.children) if (child && child.props.id != BDFDB.DiscordConstants.FriendsSections.ADD_FRIEND) {
								let newChildren = [child.props.children].flat().filter(n => !n || !n.props || n.props.count == undefined);
								switch (child.props.id) {
									case BDFDB.DiscordConstants.FriendsSections.ALL:
										newChildren.push(this.createBadge(relationshipCount[BDFDB.DiscordConstants.RelationshipTypes.FRIEND]));
										break;
									case favorizedFriendsSection:
										newChildren.push(this.createBadge(favorizedFriends.filter(id => relationships[id] == BDFDB.DiscordConstants.RelationshipTypes.FRIEND).length));
										break;
									case BDFDB.DiscordConstants.FriendsSections.ONLINE:
										newChildren.push(this.createBadge(Object.entries(relationships).filter(n => n[1] == BDFDB.DiscordConstants.RelationshipTypes.FRIEND && !(this.settings.general.addHiddenCategory && hiddenFriends.indexOf(n[0]) > -1) && BDFDB.LibraryStores.PresenceStore.getStatus(n[0]) != BDFDB.LibraryComponents.StatusComponents.Types.OFFLINE).length));
										break;
									case BDFDB.DiscordConstants.FriendsSections.PENDING:
										newChildren.push(this.createBadge(relationshipCount[BDFDB.DiscordConstants.RelationshipTypes.PENDING_INCOMING], this.labels.incoming, relationshipCount[BDFDB.DiscordConstants.RelationshipTypes.PENDING_INCOMING] > 0));
										newChildren.push(this.createBadge(relationshipCount[BDFDB.DiscordConstants.RelationshipTypes.PENDING_OUTGOING], this.labels.outgoing));
										break;
									case BDFDB.DiscordConstants.FriendsSections.BLOCKED:
										newChildren.push(this.createBadge(relationshipCount[BDFDB.DiscordConstants.RelationshipTypes.BLOCKED]));
										break;
									case hiddenFriendsSection:
										newChildren.push(this.createBadge(hiddenFriends.filter(id => relationships[id] == BDFDB.DiscordConstants.RelationshipTypes.FRIEND).length));
										break;
								}
								child.props.children = newChildren;
							}
						}
					}
				}
			}
			
			processAnalyticsContext (e) {
				if (e.instance.props.section != BDFDB.DiscordConstants.AnalyticsSections.FRIENDS_LIST) return;
				let [children, index] = BDFDB.ReactUtils.findParent(e.instance, {filter: n => n && n.props && n.props.title && n.props.id});
				if (index == -1) return;
				let users = (BDFDB.ReactUtils.findChild(e.instance, {props: ["statusSections"]}) || {props: {statusSections: []}}).props.statusSections.flat(10);
				let filteredUsers = users;
				if (this.settings.general.addFavorizedCategory) {
					if (isFavoritesSelected) filteredUsers = filteredUsers.filter(n => n && n.user && favorizedFriends.indexOf(n.user.id) > -1);
				}
				if (this.settings.general.addHiddenCategory) {
					if (isHiddenSelected) filteredUsers = filteredUsers.filter(n => n && n.user && hiddenFriends.indexOf(n.user.id) > -1);
					else filteredUsers = filteredUsers.filter(n => n && n.user && hiddenFriends.indexOf(n.user.id) == -1);
				}
				children[index].props.title = BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
					align: BDFDB.LibraryComponents.Flex.Align.CENTER,
					children: [
						BDFDB.ReactUtils.createElement("div", {
							className: BDFDB.disCN._betterfriendlisttitle,
							children: this.settings.general.addFavorizedCategory && isFavoritesSelected ? `${this.labels.favorites} - ${filteredUsers.filter(u => u && u.key != placeHolderId).length}` : this.settings.general.addHiddenCategory && isHiddenSelected ? `${this.labels.hidden} - ${filteredUsers.filter(u => u && u.key != placeHolderId).length}` : children[index].props.title.replace(users.length, filteredUsers.filter(u => u && u.key != placeHolderId).length)
						}),
						this.settings.general.addSortOptions && [
							{key: "nicknameLower", label: BDFDB.LanguageUtils.LanguageStrings.USER_SETTINGS_LABEL_USERNAME},
							{key: "statusIndex", label: BDFDB.LanguageUtils.LibraryStrings.status}
						].filter(n => n).map(data => BDFDB.ReactUtils.createElement("div", {
							className: BDFDB.DOMUtils.formatClassName(BDFDB.disCN.tableheadercellwrapper, BDFDB.disCN.tableheadercell, BDFDB.disCN._betterfriendlistnamecell, sortKey == data.key && BDFDB.disCN.tableheadercellsorted, BDFDB.disCN.tableheadercellclickable),
							children: BDFDB.ReactUtils.createElement("div", {
								className: BDFDB.disCN.tableheadercellcontent,
								children: [
									data.label,
									sortKey == data.key && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SvgIcon, {
										className: BDFDB.disCN.tableheadersorticon,
										name: BDFDB.LibraryComponents.SvgIcon.Names[sortReversed ? "ARROW_UP" : "ARROW_DOWN"]
									})
								].filter(n => n)
							}),
							onClick: event => {
								if (sortKey == data.key) {
									if (!sortReversed) sortReversed = true;
									else {
										sortKey = null;
										sortReversed = false;
									}
								}
								else {
									sortKey = data.key;
									sortReversed = false;
								}
								this.rerenderList();
							}
						}))
					].flat(10).filter(n => n)
				});
			}

			processPeopleListSectionedLazy (e) {
				this.processPeopleListSectionedNonLazy(e);
			}
			
			processPeopleListSectionedNonLazy (e) {
				if (this.settings.general.addFavorizedCategory) {
					if (isFavoritesSelected) e.instance.props.statusSections = [].concat(e.instance.props.statusSections).map(section => [].concat(section).filter(entry => entry && entry.user && favorizedFriends.indexOf(entry.user.id) > -1));
				}
				if (this.settings.general.addHiddenCategory) {
					if (isHiddenSelected) e.instance.props.statusSections = [].concat(e.instance.props.statusSections).map(section => [].concat(section).filter(entry => entry && entry.user && hiddenFriends.indexOf(entry.user.id) > -1));
					else if (([].concat(e.instance.props.statusSections).flat(10)[0] || {}).type == BDFDB.DiscordConstants.RelationshipTypes.FRIEND) e.instance.props.statusSections = [].concat(e.instance.props.statusSections).map(section => [].concat(section).filter(entry => entry && entry.user && hiddenFriends.indexOf(entry.user.id) == -1));
				}
				if (sortKey) e.instance.props.statusSections = [].concat(e.instance.props.statusSections).map(section => {
					let newSection = [].concat(section);
					newSection = BDFDB.ArrayUtils.keySort(newSection.map(entry => Object.assign({}, entry, {
						statusIndex: statusSortOrder[entry.status],
						nicknameLower: entry.nickname ? entry.nickname.toLowerCase() : entry.usernameLower
					})), sortKey);
					if (sortReversed) newSection.reverse();
					if (!newSection.length) {
						let placeholder = new BDFDB.DiscordObjects.User({
							id: placeHolderId,
							username: placeHolderId
						});
						if (placeholder) newSection.push(new BDFDB.DiscordObjects.Relationship({
							activities: [],
							applicationStream: null,
							isMobile: false,
							key: placeHolderId,
							mutualGuilds: [],
							mutualGuildsLength: 0,
							status: "offline",
							type: BDFDB.DiscordConstants.RelationshipTypes.NONE,
							user: placeholder,
							usernameLower: placeholder.usernameNormalized
						}));
					}
					return newSection;
				});
			}
			
			processPeopleListItem (e) {
				if (e.node) {
					BDFDB.TimeUtils.clear(rerenderTimeout);
					rerenderTimeout = BDFDB.TimeUtils.timeout(_ => BDFDB.PatchUtils.forceAllUpdates(this, "TabBar"), 1000);
				}
				else {
					if (e.instance.props.user.id == placeHolderId) return null;
					else if (this.settings.general.addMutualGuild) {
						let mutualGuilds = BDFDB.ArrayUtils.removeCopies([].concat(BDFDB.LibraryStores.GuildMemberStore.memberOf(e.instance.props.user.id), (BDFDB.LibraryStores.UserProfileStore.getMutualGuilds(e.instance.props.user.id) || []).map(n => n && n.guild && n.guild.id)).flat()).filter(n => n);
						if (mutualGuilds && mutualGuilds.length) {
							let guildsIds = BDFDB.LibraryModules.SortedGuildUtils.getFlattenedGuildIds();
							let childrenRender = e.returnvalue.props.children;
							e.returnvalue.props.children = BDFDB.TimeUtils.suppress((...args) => {
								let returnValue = childrenRender(...args);
								let [children, index] = BDFDB.ReactUtils.findParent(returnValue, {filter: n => n && n.props && n.props.subText && n.props.user});
								if (index > -1) children.splice(index + 1, 0, BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.GuildSummaryItem, {
									className: BDFDB.disCN._betterfriendlistmutualguilds,
									guilds: mutualGuilds.sort((x, y) => guildsIds.indexOf(x) < guildsIds.indexOf(y) ? -1 : 1).map(BDFDB.LibraryStores.GuildStore.getGuild),
									showTooltip: true,
									max: 10
								}, true));
								return returnValue;
							}, "", this);
						}
					}
				}
			}
			
			createBadge (amount, text, red) {
				let badge = BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Badges.NumberBadge, {
					className: BDFDB.DOMUtils.formatClassName(BDFDB.disCN.peoplesbadge),
					count: amount,
					disableColor: !red
				});
				return text ? BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TooltipContainer, {
					text: text,
					tooltipConfig: {
						type: "bottom"
					},
					children: badge
				}) : badge;
			}
			
			rerenderList () {
				let selectedButton = document.querySelector(BDFDB.dotCNS.dmchannel + BDFDB.dotCNS.namecontainerselected + "a");
				if (selectedButton) selectedButton.click();
			}

			setLabelsByLanguage () {
				switch (BDFDB.LanguageUtils.getLanguage().id) {
					case "bg":		// Bulgarian
						return {
							context_favorizefriend:				"???????????????? ?????????????? ?????? ????????????",
							context_hidefriend:					"?????????? ??????????????",
							context_unfavorizefriend:			"???????????????????? ???? ?????????????? ???? ????????????????",
							context_unhidefriend:				"?????????????? ??????????????",
							favorites:							"????????????",
							hidden:								"????????????",
							incoming:							"??????????????",
							outgoing:							"????????????????"
						};
					case "cs":		// Czech
						return {
							context_favorizefriend:				"P??idat p????tele do obl??ben??ch",
							context_hidefriend:					"Skr??t p????tele",
							context_unfavorizefriend:			"Odebrat p????tele z obl??ben??ch",
							context_unhidefriend:				"Odkr??t p????tele",
							favorites:							"Obl??ben??",
							hidden:								"Skryt??",
							incoming:							"P??ich??zej??c??",
							outgoing:							"Odchoz??"
						};
					case "da":		// Danish
						return {
							context_favorizefriend:				"F??j ven til favoritter",
							context_hidefriend:					"Skjul ven",
							context_unfavorizefriend:			"Fjern ven fra favoritter",
							context_unhidefriend:				"Skjul ven",
							favorites:							"Favoritter",
							hidden:								"Skjult",
							incoming:							"Indg??ende",
							outgoing:							"Udg??ende"
						};
					case "de":		// German
						return {
							context_favorizefriend:				"Freund zu Favoriten hinzuf??gen",
							context_hidefriend:					"Freund ausblenden",
							context_unfavorizefriend:			"Freund aus Favoriten entfernen",
							context_unhidefriend:				"Freund einblenden",
							favorites:							"Favoriten",
							hidden:								"Versteckt",
							incoming:							"Eingehend",
							outgoing:							"Ausgehend"
						};
					case "el":		// Greek
						return {
							context_favorizefriend:				"???????????????? ?????????? ?????? ??????????????????",
							context_hidefriend:					"???????????????? ??????????",
							context_unfavorizefriend:			"?????????????????? ?????????? ?????? ???? ??????????????????",
							context_unhidefriend:				"???????????????? ??????????",
							favorites:							"??????????????????",
							hidden:								"??????????????????",
							incoming:							"????????????????????????",
							outgoing:							"??????????????????????"
						};
					case "es":		// Spanish
						return {
							context_favorizefriend:				"Agregar amigo a favoritos",
							context_hidefriend:					"Ocultar amigo",
							context_unfavorizefriend:			"Quitar amigo de favoritos",
							context_unhidefriend:				"Mostrar amigo",
							favorites:							"Favoritos",
							hidden:								"Oculto",
							incoming:							"Entrante",
							outgoing:							"Saliente"
						};
					case "fi":		// Finnish
						return {
							context_favorizefriend:				"Lis???? yst??v?? suosikkeihin",
							context_hidefriend:					"Piilota yst??v??",
							context_unfavorizefriend:			"Poista yst??v?? suosikeista",
							context_unhidefriend:				"N??yt?? yst??v??",
							favorites:							"Suosikit",
							hidden:								"Piilotettu",
							incoming:							"Saapuva",
							outgoing:							"L??htev??"
						};
					case "fr":		// French
						return {
							context_favorizefriend:				"Ajouter un ami aux favoris",
							context_hidefriend:					"Masquer l'ami",
							context_unfavorizefriend:			"Supprimer un ami des favoris",
							context_unhidefriend:				"Afficher l'ami",
							favorites:							"Favoris",
							hidden:								"Cach??",
							incoming:							"Entrant",
							outgoing:							"Sortant"
						};
					case "hi":		// Hindi
						return {
							context_favorizefriend:				"??????????????? ?????? ????????????????????? ????????? ??????????????????",
							context_hidefriend:					"??????????????? ??????????????????",
							context_unfavorizefriend:			"??????????????? ?????? ????????????????????? ?????? ???????????????",
							context_unhidefriend:				"??????????????? ??????????????????",
							favorites:							"?????????????????????",
							hidden:								"???????????? ?????????",
							incoming:							"????????? ????????????",
							outgoing:							"???????????????????????????"
						};
					case "hr":		// Croatian
						return {
							context_favorizefriend:				"Dodaj prijatelja u favorite",
							context_hidefriend:					"Sakrij prijatelja",
							context_unfavorizefriend:			"Ukloni prijatelja iz omiljenih",
							context_unhidefriend:				"Otkrij prijatelja",
							favorites:							"Favoriti",
							hidden:								"Skriven",
							incoming:							"Dolazni",
							outgoing:							"Odlazni"
						};
					case "hu":		// Hungarian
						return {
							context_favorizefriend:				"Ismer??s hozz??ad??sa a kedvencekhez",
							context_hidefriend:					"Bar??t elrejt??se",
							context_unfavorizefriend:			"Ismer??s elt??vol??t??sa a kedvencekb??l",
							context_unhidefriend:				"Bar??t megjelen??t??se",
							favorites:							"Kedvencek",
							hidden:								"Rejtett",
							incoming:							"Be??rkez??",
							outgoing:							"Kimen??"
						};
					case "it":		// Italian
						return {
							context_favorizefriend:				"Aggiungi amico ai preferiti",
							context_hidefriend:					"Nascondi amico",
							context_unfavorizefriend:			"Rimuovi amico dai preferiti",
							context_unhidefriend:				"Scopri amico",
							favorites:							"Preferiti",
							hidden:								"Nascosto",
							incoming:							"In arrivo",
							outgoing:							"Estroverso"
						};
					case "ja":		// Japanese
						return {
							context_favorizefriend:				"???????????????????????????????????????",
							context_hidefriend:					"???????????????",
							context_unfavorizefriend:			"??????????????????????????????????????????",
							context_unhidefriend:				"??????????????????",
							favorites:							"???????????????",
							hidden:								"??????",
							incoming:							"??????",
							outgoing:							"??????"
						};
					case "ko":		// Korean
						return {
							context_favorizefriend:				"??????????????? ?????? ??????",
							context_hidefriend:					"?????? ?????????",
							context_unfavorizefriend:			"?????????????????? ?????? ??????",
							context_unhidefriend:				"?????? ????????? ??????",
							favorites:							"????????????",
							hidden:								"?????????",
							incoming:							"????????????",
							outgoing:							"?????????"
						};
					case "lt":		// Lithuanian
						return {
							context_favorizefriend:				"Prid??ti draug?? prie m??gstamiausi??",
							context_hidefriend:					"Sl??pti draug??",
							context_unfavorizefriend:			"Pa??alinti draug?? i?? m??gstamiausi??",
							context_unhidefriend:				"Nerodyti draugo",
							favorites:							"M??gstamiausi",
							hidden:								"Pasl??pta",
							incoming:							"Gaunamasis",
							outgoing:							"I??einantis"
						};
					case "nl":		// Dutch
						return {
							context_favorizefriend:				"Vriend toevoegen aan favorieten",
							context_hidefriend:					"Vriend verbergen",
							context_unfavorizefriend:			"Vriend uit favorieten verwijderen",
							context_unhidefriend:				"Vriend zichtbaar maken",
							favorites:							"Favorieten",
							hidden:								"Verborgen",
							incoming:							"Inkomend",
							outgoing:							"Uitgaand"
						};
					case "no":		// Norwegian
						return {
							context_favorizefriend:				"Legg til en venn i favoritter",
							context_hidefriend:					"Skjul venn",
							context_unfavorizefriend:			"Fjern venn fra favoritter",
							context_unhidefriend:				"Skjul venn",
							favorites:							"Favoritter",
							hidden:								"Skjult",
							incoming:							"Innkommende",
							outgoing:							"Utg??ende"
						};
					case "pl":		// Polish
						return {
							context_favorizefriend:				"Dodaj znajomego do ulubionych",
							context_hidefriend:					"Ukryj znajomego",
							context_unfavorizefriend:			"Usu?? znajomego z ulubionych",
							context_unhidefriend:				"Poka?? znajomego",
							favorites:							"Ulubione",
							hidden:								"Ukryci",
							incoming:							"Przychodz??ce",
							outgoing:							"Wychodz??ce"
						};
					case "pt-BR":	// Portuguese (Brazil)
						return {
							context_favorizefriend:				"Adicionar amigo aos favoritos",
							context_hidefriend:					"Esconder Amigo",
							context_unfavorizefriend:			"Remover amigo dos favoritos",
							context_unhidefriend:				"Reexibir amigo",
							favorites:							"Favoritos",
							hidden:								"Escondido",
							incoming:							"Entrada",
							outgoing:							"Extrovertido"
						};
					case "ro":		// Romanian
						return {
							context_favorizefriend:				"Adaug?? prieten la favorite",
							context_hidefriend:					"Ascunde prietenul",
							context_unfavorizefriend:			"Scoate??i prietenul din favorite",
							context_unhidefriend:				"Afi??eaz?? prietenul",
							favorites:							"Favorite",
							hidden:								"Ascuns",
							incoming:							"Primite",
							outgoing:							"De ie??ire"
						};
					case "ru":		// Russian
						return {
							context_favorizefriend:				"???????????????? ?????????? ?? ??????????????????",
							context_hidefriend:					"???????????? ??????????",
							context_unfavorizefriend:			"?????????????? ?????????? ???? ????????????????????",
							context_unhidefriend:				"???????????????? ??????????",
							favorites:							"??????????????????",
							hidden:								"??????????????",
							incoming:							"????????????????",
							outgoing:							"??????????????????"
						};
					case "sv":		// Swedish
						return {
							context_favorizefriend:				"L??gg till v??n till favoriter",
							context_hidefriend:					"D??lj v??n",
							context_unfavorizefriend:			"Ta bort v??n fr??n favoriter",
							context_unhidefriend:				"G??m din v??n",
							favorites:							"Favoriter",
							hidden:								"Dold",
							incoming:							"Inkommande",
							outgoing:							"Utg??ende"
						};
					case "th":		// Thai
						return {
							context_favorizefriend:				"?????????????????????????????????????????????????????????????????????",
							context_hidefriend:					"??????????????????????????????",
							context_unfavorizefriend:			"????????????????????????????????????????????????????????????????????????",
							context_unhidefriend:				"??????????????????????????????????????????",
							favorites:							"??????????????????????????????",
							hidden:								"????????????????????????",
							incoming:							"??????????????????",
							outgoing:							"???????????????"
						};
					case "tr":		// Turkish
						return {
							context_favorizefriend:				"Favorilere arkada?? ekle",
							context_hidefriend:					"Arkada???? Gizle",
							context_unfavorizefriend:			"Arkada????n?? favorilerden kald??r",
							context_unhidefriend:				"Arkada???? G??ster",
							favorites:							"Favoriler",
							hidden:								"Gizli",
							incoming:							"Gelen",
							outgoing:							"D????a d??n??k"
						};
					case "uk":		// Ukrainian
						return {
							context_favorizefriend:				"???????????? ?????????? ?? ??????????????",
							context_hidefriend:					"?????????????? ??????????",
							context_unfavorizefriend:			"???????????????? ?????????? ?? ??????????????????",
							context_unhidefriend:				"???????????????? ??????????",
							favorites:							"??????????????",
							hidden:								"????????????????????",
							incoming:							"????????????",
							outgoing:							"????????????????"
						};
					case "vi":		// Vietnamese
						return {
							context_favorizefriend:				"Th??m b???n b?? v??o danh s??ch y??u th??ch",
							context_hidefriend:					"???n b???n b??",
							context_unfavorizefriend:			"X??a b???n b?? kh???i danh s??ch y??u th??ch",
							context_unhidefriend:				"B??? ???n b???n b??",
							favorites:							"Y??u th??ch",
							hidden:								"???n",
							incoming:							"M???i ?????n",
							outgoing:							"H?????ng ngoa???"
						};
					case "zh-CN":	// Chinese (China)
						return {
							context_favorizefriend:				"????????????????????????",
							context_hidefriend:					"????????????",
							context_unfavorizefriend:			"???????????????????????????",
							context_unhidefriend:				"??????????????????",
							favorites:							"?????????",
							hidden:								"??????",
							incoming:							"??????",
							outgoing:							"??????"
						};
					case "zh-TW":	// Chinese (Taiwan)
						return {
							context_favorizefriend:				"???????????????????????????",
							context_hidefriend:					"????????????",
							context_unfavorizefriend:			"??????????????????????????????",
							context_unhidefriend:				"??????????????????",
							favorites:							"????????????",
							hidden:								"??????",
							incoming:							"??????",
							outgoing:							"??????"
						};
					default:		// English
						return {
							context_favorizefriend:				"Add Friend to Favorites",
							context_hidefriend:					"Hide Friend",
							context_unfavorizefriend:			"Remove Friend from Favorites",
							context_unhidefriend:				"Unhide Friend",
							favorites:							"Favorites",
							hidden:								"Hidden",
							incoming:							"Incoming",
							outgoing:							"Outgoing"
						};
				}
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();