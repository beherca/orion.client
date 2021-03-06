/*******************************************************************************
 * @license
 * Copyright (c) 2011, 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*global window document define login logout localStorage orion */
/*browser:true*/

define(['i18n!orion/nls/messages', 'require', 'dojo', 'dijit', 'orion/commonHTMLFragments', 'orion/commands', 'orion/parameterCollectors', 
	'orion/extensionCommands', 'orion/uiUtils', 'orion/textview/keyBinding', 'orion/breadcrumbs', 'orion/splitter', 'orion/favorites', 'orion/contentTypes', 'orion/URITemplate', 'orion/PageUtil', 'orion/widgets/themes/container/ThemeSheetWriter', 'orion/searchUtils', 'orion/inputCompletion/inputCompletion', "orion/Deferred",
	'dojo/DeferredList', 'dijit/Menu', 'dijit/MenuItem', 'dijit/form/DropDownButton', 'orion/widgets/OpenResourceDialog', 'orion/widgets/UserMenu', 'orion/widgets/UserMenuDropDown'], 
        function(messages, require, dojo, dijit, commonHTML, mCommands, mParameterCollectors, mExtensionCommands, mUIUtils, mKeyBinding, mBreadcrumbs, mSplitter, mFavorites, mContentTypes, URITemplate, PageUtil, ThemeSheetWriter, mSearchUtils, mInputCompletion, Deferred){

	/**
	 * This class contains static utility methods. It is not intended to be instantiated.
	 * @class This class contains static utility methods for creating and managing 
	 * global commands.
	 * @name orion.globalCommands
	 */


	function qualifyURL(url){
	    var a = document.createElement('a'); //$NON-NLS-0$
	    a.href = url; // set string url
	    return a.href;
	}

	var notifyAuthenticationSite = qualifyURL(require.toUrl('auth/NotifyAuthentication.html')); //$NON-NLS-0$
	var authRendered = {};
	var userMenu = new orion.widgets.UserMenu();
	
	function getLabel(authService, serviceReference){
		if(authService.getLabel){
			return authService.getLabel();
		} else {
			var d = new dojo.Deferred();
			d.callback(serviceReference.properties.name);
			return d;
		}
	}
	
	var authenticationIds = [];
	
	function startProgressService(serviceRegistry){
		var progressService = serviceRegistry.getService("orion.page.progress"); //$NON-NLS-0$
		if(progressService) {
			dojo.hitch(progressService, progressService.init)("progressPane"); //$NON-NLS-0$
		}
	}
	
	function setUserName(registry, dropdown){
			
			var authService = registry.getService("orion.core.auth"); //$NON-NLS-0$
			if (authService !== null) {
				authService.getUser().then(function(jsonData){
					if( jsonData.Name ){
						//dropdown.set( 'label', jsonData.Name ); //$NON-NLS-0$
						dropdown.containerNode.textContent = jsonData.Name;
					}else if( jsonData.login ){
						dropdown.containerNode.textContent = jsonData.login;
					} 
				});
			}
		}

	/**
	 * Adds the user-related commands to the toolbar
	 * @name orion.globalCommands#generateUserInfo
	 * @function
	 */
	function generateUserInfo(serviceRegistry) {
		
		var authServices = serviceRegistry.getServiceReferences("orion.core.auth"); //$NON-NLS-0$
		authenticationIds = [];
		var userMenuPlaceholder = dojo.byId("userMenu"); //$NON-NLS-0$
		if(!userMenuPlaceholder){
			return;
		}
		
		if(!dijit.byId('logins')){ //$NON-NLS-0$
			var menuButton = new orion.widgets.UserMenuDropDown({
				id: "logins", //$NON-NLS-0$
				dropDown: userMenu,
				label: messages["Options"], 
				showLabel: true
			});
			dojo.place(menuButton.domNode, userMenuPlaceholder, "only"); //$NON-NLS-0$
			if(menuButton.valueNode) {  // accessibility, remove value node so screen reader does not stop there.
		        dojo.destroy(menuButton.valueNode);
			}
			if(menuButton.titleNode && dojo.attr(menuButton.titleNode, "title")) { //$NON-NLS-0$
				dojo.removeAttr(menuButton.titleNode, "title"); //$NON-NLS-0$
			}
			new mCommands.CommandTooltip({
				connectId: [menuButton.focusNode],
				label: messages['Options'],
				position: ["above", "left", "right", "below"] // otherwise defaults to right and obscures adjacent commands //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			});
			
			setUserName( serviceRegistry, menuButton );
		}
		
		for(var i=0; i<authServices.length; i++){
			var servicePtr = authServices[i];
			var authService = serviceRegistry.getService(servicePtr);		
			dojo.hitch(this, function(authService, servicePtr){
					getLabel(authService, servicePtr).then(function(label){			
					authService.getKey().then(function(key){
						authenticationIds.push(key);
						authService.getUser().then(function(jsonData){
							userMenu.addUserItem(key, authService, label, jsonData);
						}, 
						function(errorData, jsonData){
							userMenu.addUserItem(key, authService, label, jsonData);
						});
						window.addEventListener("storage", function(e){ //$NON-NLS-0$
							if(authRendered[key] === localStorage.getItem(key)){
								return;
							}
							
							authRendered[key] = localStorage.getItem(key);
							
							authService.getUser().then(function(jsonData){
								userMenu.addUserItem(key, authService, label, jsonData);
							}, 
							function(errorData){
								userMenu.addUserItem(key, authService, label);
							});				
						}, false);
					});							
				});
			})(authService, servicePtr);
		}
		
	}
	
	function _addSearchPopUp(mainMenu, popUpLabel, serviceRegistry, type, makeLabelFunc){
		var choicesMenu = new dijit.Menu({
			style: "display: none;" //$NON-NLS-0$
		});
		var popup = new dijit.PopupMenuItem({
			label: popUpLabel,
			popup: choicesMenu
		});
		mainMenu.addChild(popup);
		mSearchUtils.populateSearchMenu(serviceRegistry, choicesMenu, type, function(theSearch){
			return makeLabelFunc(theSearch);
		});
		dojo.connect(mainMenu, "_openPopup", popup, function(event) { //$NON-NLS-0$
			mSearchUtils.populateSearchMenu(serviceRegistry, choicesMenu, type, function(theSearch){
				return makeLabelFunc(theSearch);
			});
		});
	}

	function createSearchLink(query, name) {
		var link = document.createElement("a"); //$NON-NLS-0$
		link.href = require.toUrl("search/search.html") + "#" + query; //$NON-NLS-1$ //$NON-NLS-0$
		link.textContent = name;
		return link;
	}
		
	function _addSearchOptions(serviceRegistry, commandService, searcher, openInNewTab) {
		var optionMenu = dijit.byId("searchOptionsDropDown"); //$NON-NLS-0$
		if (optionMenu) {
			optionMenu.destroy();
		}
		var newMenu = new dijit.Menu({
			style: "display: none;padding:0px;border-radius:3px;", //$NON-NLS-0$
			id : "searchOptionsMenu" //$NON-NLS-0$
		});
		dojo.addClass(newMenu.domNode, "commandMenu"); //$NON-NLS-0$
		
		newMenu.addChild(new dijit.CheckedMenuItem({
			label: messages["Open in new tab"],
			checked: openInNewTab,
			onChange : function(checked) {
				mSearchUtils.setOpenSearchPref(serviceRegistry, checked);
			}
		}));
		newMenu.addChild(new dijit.MenuSeparator());
		
		newMenu.addChild(new dijit.CheckedMenuItem({
			label: messages["Regular expression"],
			checked: false,
			onChange : function(checked) {
				searcher.useRegEx = checked;
			}
		}));
		newMenu.addChild(new dijit.MenuSeparator());
		
		//Add the recent searches as popups
		_addSearchPopUp(newMenu,  messages["Recent searches"], serviceRegistry, "recentSearch", function(theSearch){
			return createSearchLink(searcher.createSearchQuery(theSearch.name, false, null, false, null, theSearch.regEx), theSearch.name);
		});
		//Add the saved searches as popups
		_addSearchPopUp(newMenu,  messages["Saved searches"], serviceRegistry, "search", function(theSearch){
			return createSearchLink(theSearch.query, theSearch.name);
		});
		
		var menuButton = new orion.widgets.UserMenuDropDown({
			label : messages["Search options"],
			showLabel: false,
			id : "searchOptionsDropDown", //$NON-NLS-0$
			dropDown : newMenu
		});
		if(menuButton.valueNode) {  // accessibility, remove value node so screen reader does not stop there.
			dojo.destroy(menuButton.valueNode);
		}
		if(menuButton.titleNode && dojo.attr(menuButton.titleNode, "title")) { //$NON-NLS-0$
			dojo.removeAttr(menuButton.titleNode, "title"); //$NON-NLS-0$
		}

		dojo.addClass(menuButton.domNode, "bannerMenu"); //$NON-NLS-0$
		dojo.addClass(menuButton.domNode, "bannerMenuSearchOptions"); //$NON-NLS-0$
		dojo.place(menuButton.domNode, "searchOptions", "last"); //$NON-NLS-1$ //$NON-NLS-0$
	}
	// Related links menu management.  The related drop down widget and its associated dropdown menu
	// are created when needed.  The links menu is reused as content changes.  If the links menu becomes
	// empty, we hide the dropdown.
	var linksMenu;
	var pageItem;
	var exclusions = [];
	var favoriteTarget = null;
	var title;
	
	function _emptyLinksMenu() {
		var related = dojo.byId("relatedLinks"); //$NON-NLS-0$
		if(!related){
			// document not loaded
			return;
		}
		if (linksMenu) {
			var dropdown = dijit.byId("related"); //$NON-NLS-0$
			if (dropdown) {
				dropdown.closeDropDown();
			}
			// see http://bugs.dojotoolkit.org/ticket/10296
			linksMenu.focusedChild = null;
			dojo.forEach(linksMenu.getChildren(), function(child) {
				linksMenu.removeChild(child);
				child.destroy();
			});
		}
	}
	
	function _checkForEmptyLinksMenu() {
		var dropdownNode = dojo.byId("relatedLinks"); //$NON-NLS-0$
		if (linksMenu && dropdownNode) {
			if (linksMenu.getChildren().length === 0) {
				dojo.style(dropdownNode, "visibility", "hidden"); //$NON-NLS-0$ //$NON-NLS-1$
			} else {
				dojo.style(dropdownNode, "visibility", "visible");//$NON-NLS-0$ //$NON-NLS-1$
			}
		}
	}
	
	function _addRelatedLinkCommand(command, invocation) {
		if (!linksMenu) {
			linksMenu = new dijit.Menu({
				style: "display: none;padding:3px;border-radius:3px;", //$NON-NLS-0$
				id: "relatedLinksMenu" //$NON-NLS-0$
			});
		}
		command._addMenuItem(linksMenu, invocation);

		var menuButton = dijit.byId("related"); //$NON-NLS-0$
		var domNode = dojo.byId("relatedLinks"); //$NON-NLS-0$
		if (domNode && !menuButton) {
			menuButton = new orion.widgets.UserMenuDropDown({
				id: "related", //$NON-NLS-0$
				label: messages["Related"],
				dropDown: linksMenu
			});
			if(menuButton.valueNode) {  // accessibility, remove value node so screen reader does not stop there.
				dojo.destroy(menuButton.valueNode);
			}
			if(menuButton.titleNode && dojo.attr(menuButton.titleNode, "title")) { //$NON-NLS-0$
				dojo.removeAttr(menuButton.titleNode, "title"); //$NON-NLS-0$
			}
			dojo.addClass(menuButton.domNode, "bannerMenu"); //$NON-NLS-0$
			dojo.place(menuButton.domNode, domNode, "only"); //$NON-NLS-0$
		}	
	}	
	/**
	 * Adds the related links to the banner
	 * @name orion.globalCommands#generateRelatedLinks
	 * @function
	 */
	function generateRelatedLinks(serviceRegistry, item, exclusions, commandService, alternateItem) {
		var contentTypesCache;
		function getContentTypes() {
			if (contentTypesCache) {
				return contentTypesCache;
			}
			var contentTypeService = serviceRegistry.getService("orion.core.contenttypes"); //$NON-NLS-0$
			//TODO Shouldn't really be making service selection decisions at this level. See bug 337740
			if (!contentTypeService) {
				contentTypeService = new mContentTypes.ContentTypeService(serviceRegistry);
				contentTypeService = serviceRegistry.getService("orion.core.contenttypes"); //$NON-NLS-0$
			}
			return contentTypeService.getContentTypes().then(function(ct) {
				contentTypesCache = ct;
				return contentTypesCache;
			});
		}

		var contributedLinks = serviceRegistry.getServiceReferences("orion.page.link.related"); //$NON-NLS-0$
		if (contributedLinks.length <= 0) {
			return;
		}
		var related = dojo.byId("relatedLinks"); //$NON-NLS-0$
		if(!related){
			// document not loaded
			return;
		}
		
		dojo.when(getContentTypes(), dojo.hitch(this, function() {
			var alternateItemDeferred;
			_emptyLinksMenu();
			var deferreds = [];
			
			// assemble the related links
			for (var i=0; i<contributedLinks.length; i++) {
				var info = {};
				var j;
				var propertyNames = contributedLinks[i].getPropertyKeys();
				for (j = 0; j < propertyNames.length; j++) {
					info[propertyNames[j]] = contributedLinks[i].getProperty(propertyNames[j]);
				}
				if (info.id) {
					function enhanceCommand(command){
						if (command) {
							if (!command.visibleWhen || command.visibleWhen(item)) {
								var invocation = new mCommands.CommandInvocation(commandService, item, item, null, command);
								_addRelatedLinkCommand(command, invocation);
							} else if (typeof alternateItem === "function") { //$NON-NLS-0$
								if (!alternateItemDeferred) {
									alternateItemDeferred = alternateItem();
								}
								dojo.when(alternateItemDeferred, dojo.hitch(command, function (newItem) {
									if (newItem && (item === pageItem)) { // there is an alternate, and it still applies to the current page target
										if (!this.visibleWhen || this.visibleWhen(newItem)) {
											_addRelatedLinkCommand(this, new mCommands.CommandInvocation(commandService, newItem, newItem, null, this));
										}
									}
								}));
							}
						} 
					}
					
					var command = null;
					// exclude anything in the list of exclusions
					var position = dojo.indexOf(exclusions, info.id);
					if (position < 0) {
						// First see if we have a uriTemplate and name, which is enough to build a command internally.
						if (((info.nls && info.nameKey) || info.name) && info.uriTemplate) {
							var deferred = mExtensionCommands._createCommandOptions(info, contributedLinks[i], serviceRegistry, contentTypesCache, true);
							deferreds.push(deferred);
							deferred.then(
									dojo.hitch(this, function(commandOptions){
										var command = new mCommands.Command(commandOptions);
										enhanceCommand(command);
									}));
							continue;
						}
						// If we couldn't compose one, see if one is already registered.
						if (!command) {
							command = commandService.findCommand(info.id);
							if(command){
								enhanceCommand(command);
								continue;
							}
						}
						// If it's not registered look for it in orion.navigate.command and create it
						if (!command) {
							var commandsReferences = serviceRegistry.getServiceReferences("orion.navigate.command"); //$NON-NLS-0$
							for (j=0; j<commandsReferences.length; j++) {
								var id = commandsReferences[j].getProperty("id"); //$NON-NLS-0$
								if (id === info.id) {
									var navInfo = {};
									propertyNames = commandsReferences[j].getPropertyKeys();
									for (var k = 0; k < propertyNames.length; k++) {
										navInfo[propertyNames[k]] = commandsReferences[j].getProperty(propertyNames[k]);
									}
									deferred = mExtensionCommands._createCommandOptions(navInfo, commandsReferences[j], serviceRegistry, contentTypesCache, true);
									deferreds.push(deferred);
									deferred.then(
											dojo.hitch(this, function(commandOptions){
												command = new mCommands.Command(commandOptions);
												enhanceCommand(command);
											}));
									break;
								}
							}
						} 

					}
				} 
			}
			new dojo.DeferredList(deferreds).addBoth(dojo.hitch(this, function(){
				_checkForEmptyLinksMenu();
			}));
		}));
	}
	
	function renderGlobalCommands(commandService) {
		var globalTools = dojo.byId("globalActions"); //$NON-NLS-0$
		if (globalTools) {	
			commandService.destroy(globalTools);
			commandService.renderCommands(globalTools.id, globalTools, {}, {}, "tool"); //$NON-NLS-0$
		}
	}
	
	/**
	 * Support for establishing a page item associated with global commands and related links
	 */

	function setPageCommandExclusions(excluded) {
		exclusions = excluded;
	}
	
	function makeFavorite(serviceRegistry) {
		var favoriteService = serviceRegistry.getService("orion.core.favorite"); //$NON-NLS-0$
		//TODO Shouldn't really be making service selection decisions at this level. See bug 337740
		if (!favoriteService) {
			favoriteService = new mFavorites.FavoritesService({serviceRegistry: serviceRegistry});
			favoriteService = serviceRegistry.getService("orion.core.favorite"); //$NON-NLS-0$
		}
		if (favoriteTarget && favoriteTarget.Location) {
			favoriteService.hasFavorite(favoriteTarget.ChildrenLocation || favoriteTarget.Location).then(function(result) {
				if (!result) {
					favoriteService.makeFavorites([favoriteTarget]);
					serviceRegistry.getService("orion.page.message").setMessage(favoriteTarget.Name + messages[" has been added to the favorites list."], 2000); //$NON-NLS-0$
				} else {
					serviceRegistry.getService("orion.page.message").setMessage(favoriteTarget.Name + messages[" is already a favorite."], 2000); //$NON-NLS-0$
				}
			});
		} 
	}
	
	// Hook up favorites button
	function checkFavoritesButton(serviceRegistry, commandService) {
		var faveButton = dojo.byId("pageFavorite"); //$NON-NLS-0$
		if (faveButton) {
			if (favoriteTarget && favoriteTarget.Location) {
				dojo.addClass(faveButton, "bannerButton"); //$NON-NLS-0$
				dojo.connect(faveButton, "onclick", this, function() { //$NON-NLS-0$
					makeFavorite(serviceRegistry);
				});
				// onClick events do not register for spans when using the keyboard
				dojo.connect(faveButton, "onkeypress", this, function(e) { //$NON-NLS-0$
					if (e.keyCode === dojo.keys.ENTER) {						
						makeFavorite(serviceRegistry);
					}
				});
				new mCommands.CommandTooltip({
					connectId: [faveButton],
					label: messages["Add to the favorites list"],
					position: ["below", "left", "right", "above"], // below since this is at top of page. //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
					commandService: commandService
				});
				dojo.style(faveButton, "visibility", "visible"); //$NON-NLS-1$ //$NON-NLS-0$
			} else {
				dojo.style(faveButton, "visibility", "hidden"); //$NON-NLS-1$ //$NON-NLS-0$
			}
		}
	}
	
	/**
	 * Set a dirty indicator for the page.  An in-page indicator will always be set.  
	 * If the document has a title (set via setPageTarget), then the title will also be updated
	 * with a dirty indicator.
	 */
	function setDirtyIndicator(isDirty) {
		if (title) {
			if (title.charAt(0) === '*' && !isDirty) { //$NON-NLS-0$
				title = title.substring(1);
			}
			if (isDirty && title.charAt(0) !== '*') { //$NON-NLS-0$
				title = '*' + title; //$NON-NLS-0$
			}
			window.document.title = title;
		}

		var dirty = dojo.byId("dirty"); //$NON-NLS-0$f
		if (dirty) {
			if (isDirty) {
				dirty.textContent = "*"; //$NON-NLS-0$
			} else {
				dirty.textContent = ""; //$NON-NLS-0$
			}
		}
	}
	/**
	 * Set the target of the page so that common infrastructure (breadcrumbs, related menu, etc.) can be
	 * added for the page.
	 * @param {Object} options The target options object.
	 * @param {String} options.task the name of the user task that the page represents.
	 * @param {Object} options.target the metadata describing the page resource target.  Optional.
	 * @param {String} options.name the name of the resource that is showing on the page.  Optional.  If a target
	 * parameter is supplied, the target metadata name will be used if a name is not specified in the options.
	 * @param {String} options.title the title to be used for the page.  Optional.  If not specified, a title
	 * will be constructed using the task and/or name.
	 * @param {String} options.breadcrumbRootName the name used for the breadcrumb root.  Optional.  If not
	 * specified, the breadcrumbTarget, fileService, task, and name will be consulted to form a root name.
	 * @param {Object} options.breadcrumbTarget the metadata used for the breadcrumb target. Optional.  If not
	 * specified, options.target is used as the breadcrumb target.
	 * @param {Boolean} options.isFavoriteTarget true if the target can be a favorite. Optional. If specified, 
	 * a favorites button will be added to the banner.  
	 * @param {Function} options.makeAlternate a function that can supply alternate metadata for the related
	 * pages menu if the target does not validate against a contribution.  Optional.
	 * @param {Function} options.makeBreadcrumbLink a function that will supply a breadcrumb link based on a location
	 * shown in a breadcrumb.  Optional.  If not specified, and if a target is specified, the breadcrumb link will
	 * refer to the Navigator.
	 * @param {Object} options.serviceRegistry the registry to use for obtaining any unspecified services.  Optional.  
	 * If not specified, then any banner elements requiring Orion services will not be provided.
	 * @param {Object} options.commandService the commandService used for accessing related page commands.  Optional.
	 * If not specified, a related page menu will not be shown.
	 * @param {Object} options.searchService the searchService used for scoping the searchbox.  Optional.  If not 
	 * specified, the searchbox will not be scoped.
	 * @param {Object} options.fileService the fileService used for retrieving additional metadata and managing
	 * the breadcrumb for multiple file services.  If not specified, there may be reduced support for multiple file 
	 * implementations.
	 *
	 */
	function setPageTarget(options) {
		var name;
		var fileSystemRootName;
		var breadcrumbRootName = options.breadcrumbRootName;
		if (options.target) {  // we have metadata
			if (options.searchService) {
				options.searchService.setLocationByMetaData(options.target); //$NON-NLS-0$
			}
			if (options.fileService && !options.breadcrumbTarget) {
				fileSystemRootName = breadcrumbRootName ? breadcrumbRootName + " " : "";  //$NON-NLS-0$
				fileSystemRootName = fileSystemRootName +  options.fileService.fileServiceName(options.target.Location);
				breadcrumbRootName = null;
			} 
			name = options.name || options.target.Name;
			pageItem = options.target;
			generateRelatedLinks(options.serviceRegistry, options.target, exclusions, options.commandService, options.makeAlternate);
		} else {
			if (!options.breadcrumbTarget) {
				breadcrumbRootName = breadcrumbRootName || options.task || options.name;
			}
			name = options.name;
		}
		title = options.title;
		if (!title) {
			if (name) {
				title = name + " - "+ options.task;
			} else {
				title = options.task;
			}
		} 
		window.document.title = title;
		dojo.empty("location"); //$NON-NLS-0$
		new mBreadcrumbs.BreadCrumbs({
			container: "location",  //$NON-NLS-0$
			resource: options.breadcrumbTarget || options.target,
			rootSegmentName: breadcrumbRootName,
			workspaceRootSegmentName: fileSystemRootName,
			makeHref: options.makeBreadcrumbLink
		});
		if (options.target && options.isFavoriteTarget) {
			favoriteTarget = options.target;
		} else {
			favoriteTarget = null;
		}
		checkFavoritesButton(options.serviceRegistry, options.commandService);
	}
	
	
	function applyTheme(preferences){
	
		preferences.getPreferences('/themes', 2).then(function(prefs){ //$NON-NLS-0$
			
			var selected = prefs.get( 'selected' ); //$NON-NLS-0$
			
			if( selected ){
				var ob = JSON.parse( selected );
				
				var styles = JSON.parse( prefs.get( 'styles' ) ); //$NON-NLS-0$
				
				for( var theme in styles ){
					
					var cssdata;
					
					if( styles[theme].name === ob.selected ){
						cssdata = styles[theme];
						var sheetMaker = new ThemeSheetWriter.ThemeSheetWriter();
						var css = sheetMaker.getSheet( cssdata );
				
						var stylesheet = document.createElement("STYLE"); //$NON-NLS-0$
						stylesheet.appendChild(document.createTextNode(css));
							
						var head = document.getElementsByTagName("HEAD")[0] || document.documentElement; //$NON-NLS-0$
						head.appendChild(stylesheet);	
						break;
					}	
				}
			}		
		});
	}
	
	function getToolbarElements(toolNode) {
		var elements = {};
		var toolbarNode = null;
		if (typeof toolNode === "string") { //$NON-NLS-0$
			toolNode = dojo.byId(toolNode);
		}
		// no reference node has been given, so use the main toolbar.
		if (!toolNode) {
			toolNode = dojo.byId("pageActions");
		}
		var node = toolNode;
		// the trickiest part is finding where to start looking (section or main toolbar).
		// We need to walk up until we find a "toolComposite"

		while (node) {
			if (dojo.hasClass(node, "toolComposite")) { //$NON-NLS-0$
				toolbarNode = node;
				break;
			}
			node = node.parentNode;
		}
		if (dojo.hasClass(toolNode, "commandMarker")) { //$NON-NLS-0$
			elements.commandNode = toolNode;
		}
		if (toolbarNode) {
			elements.slideContainer = dojo.query(".slideParameters", toolbarNode)[0]; //$NON-NLS-0$
			elements.parameterArea = dojo.query(".parameters", toolbarNode)[0]; //$NON-NLS-0$
			elements.dismissArea = dojo.query(".parametersDismiss", toolbarNode)[0]; //$NON-NLS-0$
			elements.notifications = dojo.query("#notificationArea", toolbarNode)[0]; //$NON-NLS-0$
			if (toolbarNode.parentNode) {
				elements.toolbarTarget = dojo.query(".toolbarTarget", toolbarNode.parentNode)[0]; //$NON-NLS-0$
				if (elements.toolbarTarget) {
					var pos = dojo.position(toolbarNode);
					// assumes that there is never anything besides notifications and slideout between toolbar and its target
					// see https://bugs.eclipse.org/bugs/show_bug.cgi?id=391596
					elements.toolbarTargetY = pos.h+1;   
				}
			}
		}
		return elements;
	}
	
	function layoutToolbarElements(elements) {
		if (elements.toolbarTarget && elements.toolbarTargetY) {
			var heightExtras = 0;
			var pos;
			if (elements.notifications && dojo.hasClass(elements.notifications, "slideContainerActive")) { //$NON-NLS-0$
				pos = dojo.position(elements.notifications);
				heightExtras += pos.h;
			}
			if (elements.slideContainer && dojo.hasClass(elements.slideContainer, "slideContainerActive")) { //$NON-NLS-0$
				pos = dojo.position(elements.slideContainer);
				heightExtras += pos.h;
			}
			if (heightExtras > 0) {
				heightExtras += 8;  // padding
			}
			dojo.style(elements.toolbarTarget, {"top": elements.toolbarTargetY + heightExtras + "px", "bottom": 0}); //$NON-NLS-0$ //$NON-NLS-1$ //$NON-NLS-2$
		}
	}
	
	
	/**
	 * Generates the banner at the top of a page.
	 * @name orion.globalCommands#generateBanner
	 * @function
	 */
	function generateBanner(parentId, serviceRegistry, commandService, prefsService, searcher, handler, /* optional */ editor, /* optional */ escapeProvider) {
		var text;
		
		applyTheme( prefsService );
		
		var target = "_self"; //$NON-NLS-0$
		var parent = dojo.byId(parentId);
		
		if (!dojo.byId("staticBanner")) { //$NON-NLS-0$
			if (!parent) {
				throw messages["could not find banner parent, id was "] + parentId;
			}
			// place the HTML fragment for the header.
			dojo.place(commonHTML.topHTMLFragment, parent, "first"); //$NON-NLS-0$
		}
		
		var toolbar = dojo.byId("pageToolbar"); //$NON-NLS-0$
		if (toolbar) {
			dojo.addClass(toolbar, "toolbarLayout"); //$NON-NLS-0$
			dojo.place(commonHTML.toolbarHTMLFragment, toolbar, "only"); //$NON-NLS-0$
		}
		
		var footer = dojo.byId("footer"); //$NON-NLS-0$
		if (footer) {
			dojo.place(commonHTML.bottomHTMLFragment, footer, "only"); //$NON-NLS-0$
		}
		
		// Set up a custom parameter collector that slides out of adjacent tool areas.
		commandService.setParameterCollector(new mParameterCollectors.CommandParameterCollector(getToolbarElements, layoutToolbarElements));
		
		// place an empty div for keyAssist
		dojo.place('<div id="keyAssist" style="display: none" class="keyAssistFloat" role="list" aria-atomic="true" aria-live="assertive"></div>', document.body, "last"); //$NON-NLS-1$ //$NON-NLS-0$
		
		// generate primary nav links. 
		var primaryNav = dojo.byId("primaryNav"); //$NON-NLS-0$
		if (primaryNav) {
			// Note that the shape of the "orion.page.link" extension is not in any shape or form that could be considered final.
			// We've included it to enable experimentation. Please provide feedback on IRC or bugzilla.
			
			// The shape of a contributed navigation link is (for now):
			// info - information about the navigation link (object).
			//     required attribute: name - the name of the navigation link
			//     required attribute: id - the id of the navigation link
			//     required attribute: uriTemplate - the URL for the navigation link
			//     optional attribute: image - a URL to an icon representing the link (currently not used, may use in future)
			var navLinks= serviceRegistry.getServiceReferences("orion.page.link"); //$NON-NLS-0$
			var params = PageUtil.matchResourceParameters(window.location.href);
			// TODO: should not be necessary, see bug https://bugs.eclipse.org/bugs/show_bug.cgi?id=373450
			var hostName = window.location.protocol + "//" + window.location.host; //$NON-NLS-0$
			var locationObject = {OrionHome: hostName, Location: params.resource};
			for (var i=0; i<navLinks.length; i++) {
				var info = {};
				var propertyNames = navLinks[i].getPropertyKeys();
				for (var j = 0; j < propertyNames.length; j++) {
					info[propertyNames[j]] = navLinks[i].getProperty(propertyNames[j]);
				}
			if(info.uriTemplate && info.nls && (info.name || info.nameKey)){
				require(['i18n!'+info.nls], function(commandMessages){
					var uriTemplate = new URITemplate(info.uriTemplate);
					var expandedHref = window.decodeURIComponent(uriTemplate.expand(locationObject));
					expandedHref = PageUtil.validateURLScheme(expandedHref);
					var link = dojo.create("a", {href: expandedHref, target: target, 'class':'targetSelector'}, primaryNav, "last"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
					text = document.createTextNode(info.nameKey? commandMessages[info.nameKey]: info.name);
					dojo.place(text, link, "only"); //$NON-NLS-0$
				});
			} else if (info.uriTemplate && info.name) {
					var uriTemplate = new URITemplate(info.uriTemplate);
					var expandedHref = window.decodeURIComponent(uriTemplate.expand(locationObject));
					expandedHref = PageUtil.validateURLScheme(expandedHref);
					var link = dojo.create("a", {href: expandedHref, target: target, 'class':'targetSelector'}, primaryNav, "last"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
					text = document.createTextNode(info.name);
					dojo.place(text, link, "only"); //$NON-NLS-0$
				}
			}
		}
		
		// hook up search box: 1.The search box itself 2.Default search proposal provider(recent and saved search) 
		//                     3.Extended proposal provider from plugins 4.Search options(open result in new tab, reg ex, recent&saved searc hfull list)
		var searchField = dojo.byId("search"); //$NON-NLS-0$
		if (!searchField) {
			throw "failed to generate HTML for banner"; //$NON-NLS-0$
		}
		//Required. Reading recent&saved search from user preference. Once done call the uiCallback
		var defaultProposalProvider = function(uiCallback){
			mSearchUtils.getMixedSearches(serviceRegistry, true, function(searches){
				var i, fullSet = [], hasSavedSearch = false;
				for (i in searches) {
					if(searches[i].label){
						if(!hasSavedSearch){
							fullSet.push({type: "category", label: "Saved searches"});//$NON-NLS-0$ //$NON-NLS-0$
							hasSavedSearch = true;
						}
						fullSet.push({type: "proposal", label: searches[i].label, value: searches[i].name});//$NON-NLS-0$
					} else {
						fullSet.push({type: "proposal", label: searches[i].name, value: searches[i].name});//$NON-NLS-0$
					}
				}
				uiCallback(fullSet);
			});
		};
		//Optional. Reading extended search proposals by asking plugins, if any.
		//If there are multiple plugins then merge all the proposals and call uiCallBack.
		//Plugins(with service id "orion.search.proposal") should define the property "filterForMe" to true or false. Which means:
		//If true the inputCompletion class will filter the proposals returned by the plugin.
		//If false the inputCompletion class assumes that the proposals are already filtered by hte given kerword. 
		//The false case happens when a plugin wants to use the keyword to ask for a set of filtered proposal from a web service by the keyword and Orion does not need to filter it again.
		var exendedProposalProvider = function(keyWord, uiCallback){
			var serviceReferences = serviceRegistry.getServiceReferences("orion.search.proposal"); //$NON-NLS-0$
			if(!serviceReferences || serviceReferences.length === 0){
				uiCallback(null);
				return;
			}
            var promises = [];
			serviceReferences.forEach(function(serviceRef) {
				var filterForMe = serviceRef.getProperty("filterForMe");
				promises.push( serviceRegistry.getService(serviceRef).run(keyWord).then(function(returnValue) {
					//The return value has to be an array of {category : string, datalist: [string,string,string...]}
					var proposalList = {filterForMe: filterForMe, proposals: []};
					for (var i = 0; i < returnValue.length; i++) {
						proposalList.proposals.push({type: "category", label: returnValue[i].category});//$NON-NLS-0$
						for (var j = 0; j < returnValue[i].datalist.length; j++) {
							proposalList.proposals.push({type: "proposal", label: returnValue[i].datalist[j], value: returnValue[i].datalist[j]});//$NON-NLS-0$
						}
					}
					return proposalList;
				}));
			});
			Deferred.all(promises).then(function(returnValues) {
				//merge all the promise return values together
				// TODO: WAT? why are we re-creating the array
				var extendedProposals = [];
				for (var i = 0; i < returnValues.length; i++) {
					extendedProposals.push(returnValues[i]);
				}
				//Render UI
				uiCallback(extendedProposals);
			});
		};
		//Create and hook up the inputCompletion instance with the search box dom node.
		//The defaultProposalProvider provides proposals from the recent and saved searches.
		//The exendedProposalProvider provides proposals from plugins.
		var searchCompletion = new mInputCompletion.InputCompletion(searchField, defaultProposalProvider,
									{group: "globalSearch", extendedProvider: exendedProposalProvider});//$NON-NLS-0$
		//Both inputCompletion and here are listening keydown events on searchField
		//But here listener should yield to inputCompletion on its "already handled" events.
		searchField.addEventListener("keydown", function(e) { //$NON-NLS-0$
			if(e.defaultPrevented){// If the key event was handled by other listeners and preventDefault was set on(e.g. input completion handled ENTER), we do not handle it here
				return;
			}
			var keyCode= e.charCode || e.keyCode;
			if (keyCode === 13 ) {// ENTER
				if (searcher) {
					if (searchField.value.length > 0) {
						mSearchUtils.addRecentSearch(serviceRegistry, searchField.value, searcher.useRegEx);
						var query = searcher.createSearchQuery(searchField.value);
						mSearchUtils.getOpenSearchPref(serviceRegistry, function(openInNewTab){
							var href = require.toUrl("search/search.html") + "#"+query; //$NON-NLS-1$ //$NON-NLS-0$
							if(openInNewTab){
								window.open(href);
							} else {
								window.location = href;
							}
						});
					}
				} else {
					window.alert(messages["Can't search: no search service is available"]);
				}
			} 
		});
		//Finally, hook up search options
		mSearchUtils.getOpenSearchPref(serviceRegistry, function(openInNewTab){
			_addSearchOptions(serviceRegistry, commandService, searcher, openInNewTab);
		});
		
		// layout behavior.  Special handling for pages that use dijit for interior layout.
		var dijitLayout = dojo.query(".dijitManagesLayout")[0]; //$NON-NLS-0$
		var layoutWidget;
		if (dijitLayout && dijitLayout.id) {
			layoutWidget = dijit.byId(dijitLayout.id);
		}
		// hook up split behavior - the splitter widget and the associated global command/key bindings.
		var splitter;
		var splitNode = dojo.query(".split")[0]; //$NON-NLS-0$
		if (splitNode) {
			var side = dojo.query(".sidePanelLayout")[0]; //$NON-NLS-0$
			var main = dojo.query(".mainPanelLayout")[0]; //$NON-NLS-0$
			if (side && main) {
				splitter = new mSplitter.Splitter({node: splitNode, sidePanel: side, mainPanel: main});
				var toggleSidePanelCommand = new mCommands.Command({
					name: "Toggle side panel",
					tooltip:"Open or close the side panel",
					id: "orion.toggleSidePane", //$NON-NLS-0$
					callback: function() {
						splitter.toggleSidePanel();}
				});
				commandService.addCommand(toggleSidePanelCommand);
				commandService.registerCommandContribution("pageActions", "orion.toggleSidePane", 1, null, true, new mCommands.CommandKeyBinding('o', true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

				// editor and layout specific behavior if needed
				if (editor || layoutWidget) {
					splitter.addResizeListener(function(node) {
						if (editor && node === main) {
							editor.getTextView().resize();
						}
						if (layoutWidget) {
							layoutWidget.resize();
						}
					});
					if (editor) {
						editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding("o", true), "toggleOutliner"); //$NON-NLS-1$ //$NON-NLS-0$
						editor.getTextView().setAction("toggleOutliner", function(){ //$NON-NLS-0$
							splitter.toggleSidePanel();
							return true;
						}, {name:"Toggle Outliner"});
					}
				}
			}
		}
		
		// trigger a layout for pages that still manage inner content with dijit layouts.
		if (layoutWidget) {
			window.setTimeout(function() {layoutWidget.layout();}, 10);
		}
			
		// Assemble global commands, those that could be available from any page due to header content or common key bindings.
		// make favorite
		var favoriteCommand = new mCommands.Command({
			name: messages["Make Favorite"],
			tooltip: messages['Add to the favorites list'],
			imageClass: "core-sprite-makeFavorite", //$NON-NLS-0$
			id: "orion.makeFavorite", //$NON-NLS-0$
			visibleWhen: function(item) {
				var items = dojo.isArray(item) ? item : [item];
				if (items.length === 0) {
					return false;
				}
				for (var i=0; i < items.length; i++) {
					if (!items[i].Location) {
						return false;
					}
				}
				return true;},
			callback: function(data) {
				var items = dojo.isArray(data.items) ? data.items : [data.items];
				var favService = serviceRegistry.getService("orion.core.favorite"); //$NON-NLS-0$
				var doAdd = function(item) {
					return function(result) {
						if (!result) {
							favService.makeFavorites(item);
						} else {
							serviceRegistry.getService("orion.page.message").setMessage(item.Name + messages[' is already a favorite.'], 2000); //$NON-NLS-0$
						}
					};
				};
				for (var i = 0; i < items.length; i++) {
					var item = items[i];
					favService.hasFavorite(item.ChildrenLocation || item.Location).then(doAdd(item));
				}
			}});
		commandService.addCommand(favoriteCommand);
	
		// open resource
		var openResourceDialog = function(searcher, serviceRegistry, /* optional */ editor) {
			var favoriteService = serviceRegistry.getService("orion.core.favorite"); //$NON-NLS-0$
			//TODO Shouldn't really be making service selection decisions at this level. See bug 337740
			if (!favoriteService) {
				favoriteService = new mFavorites.FavoritesService({serviceRegistry: serviceRegistry});
				//service must be accessed via the registry so we get async behaviour
				favoriteService = serviceRegistry.getService("orion.core.favorite"); //$NON-NLS-0$
			}
			var dialog = new orion.widgets.OpenResourceDialog({searcher: searcher, searchRenderer:searcher.defaultRenderer, favoriteService:favoriteService});
			if (editor) {
				dojo.connect(dialog, "onHide", function() { //$NON-NLS-0$
					editor.getTextView().focus(); // Focus editor after dialog close, Dojo's doesn't work
				});
			}
			window.setTimeout(function() {dialog.show();}, 0);
		};
			
		var openResourceCommand = new mCommands.Command({
			name: messages["Find File Named..."],
			tooltip: messages["Choose a file by name and open an editor on it"],
			id: "eclipse.openResource", //$NON-NLS-0$
			callback: function(data) {
				openResourceDialog(searcher, serviceRegistry, editor);
			}});
			
		// set binding in editor and a general one for other pages
		if (editor) {
			editor.getTextView().setKeyBinding(new mKeyBinding.KeyBinding("f", true, true, false), openResourceCommand.id);   //$NON-NLS-0$
			editor.getTextView().setAction(openResourceCommand.id, function() {
					openResourceDialog(searcher, serviceRegistry, editor);
					return true;
				}, openResourceCommand);
		}
		
		commandService.addCommand(openResourceCommand);
		commandService.registerCommandContribution("globalActions", "eclipse.openResource", 100,  null, true, new mCommands.CommandKeyBinding('f', true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

		// Toggle trim command
		var toggleBanner = new mCommands.Command({
			name: messages["Toggle banner and footer"],
			tooltip: messages["Hide or show the page banner and footer"],
			id: "orion.toggleTrim", //$NON-NLS-0$
			callback: function() {
				var header = dojo.byId("banner"); //$NON-NLS-0$
				var footer = dojo.byId("footer"); //$NON-NLS-0$
				var content = dojo.query(".content-fixedHeight")[0]; //$NON-NLS-0$
				if (header.style.display === "none") { //$NON-NLS-0$
					header.style.display = "block"; //$NON-NLS-0$
					footer.style.display = "block"; //$NON-NLS-0$
					dojo.removeClass(content, "content-fixedHeight-maximized"); //$NON-NLS-0$
				} else {
					header.style.display = "none"; //$NON-NLS-0$
					footer.style.display = "none"; //$NON-NLS-0$
					dojo.addClass(content, "content-fixedHeight-maximized"); //$NON-NLS-0$
				}	
				if (editor) {
					editor.getTextView().resize();
				}
				if (layoutWidget) {
					window.setTimeout(function() {layoutWidget.resize();}, 10);
				}
				return true;
			}});
		commandService.addCommand(toggleBanner);
		commandService.registerCommandContribution("globalActions", "orion.toggleTrim", 100, null, true, new mCommands.CommandKeyBinding("m", true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
		
		if (editor) {
			editor.getTextView().setKeyBinding(new mCommands.CommandKeyBinding('m', true, true), toggleBanner.id); //$NON-NLS-0$
			editor.getTextView().setAction(toggleBanner.id, toggleBanner.callback, toggleBanner);
		}
				
		var keyAssistNode = dojo.byId("keyAssist"); //$NON-NLS-0$
		dojo.connect(document, "onkeypress", dojo.hitch(this, function (e){  //$NON-NLS-0$
			if (e.charOrCode === dojo.keys.ESCAPE) {
				keyAssistNode.style.display = "none"; //$NON-NLS-0$
			}
		}));
		dojo.connect(document, "onclick", dojo.hitch(this, function(e) { //$NON-NLS-0$
			var clickNode =  e.target || e.originalTarget || e.srcElement; 
			if (clickNode && clickNode.id !== "keyAssist") { //$NON-NLS-0$
				keyAssistNode.style.display = "none"; //$NON-NLS-0$
			}
		}));
		if (editor) {
			editor.getTextView().addEventListener("MouseDown", function() { //$NON-NLS-0$
				keyAssistNode.style.display = "none"; //$NON-NLS-0$
			});
		}
		
		if (escapeProvider) {
			var keyAssistEscHandler = {
				isActive: function() {
					return keyAssistNode.style.display === "block"; //$NON-NLS-0$
				},
				
				cancel: function() {
					if (this.isActive()) {
						keyAssistNode.style.display = "none"; //$NON-NLS-0$
						return true;
					}
					return false;   // not handled
				}
			};
			escapeProvider.addHandler(keyAssistEscHandler);
		}
		//	Open configuration page, Ctrl+Shift+F1
		var configDetailsCommand = new mCommands.Command({
			name: messages["System Configuration Details"],
			tooltip: messages["System Config Tooltip"],
			id: "orion.configDetailsPage", //$NON-NLS-0$
			hrefCallback: function() {
				return require.toUrl("help/about.html"); //$NON-NLS-0$
			}});
					
		commandService.addCommand(configDetailsCommand);
		commandService.registerCommandContribution("globalActions", "orion.configDetailsPage", 100,  null, true, new mCommands.CommandKeyBinding(112, true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

		//	Background Operations Page, Ctrl+Shift+O
		var operationsCommand = new mCommands.Command({
			name: messages["Background Operations"],
			tooltip: messages["Background Operations Tooltip"],
			id: "orion.backgroundOperations", //$NON-NLS-0$
			hrefCallback: function() {
				return require.toUrl("operations/list.html"); //$NON-NLS-0$
			}});
					
		commandService.addCommand(operationsCommand);
		commandService.registerCommandContribution("globalActions", "orion.backgroundOperations", 100,  null, true, new mCommands.CommandKeyBinding('o', true, true)); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$

		
		// Key assist
		var keyAssistCommand = new mCommands.Command({
			name: messages["Show Keys"],
			tooltip: messages["Show a list of all the keybindings on this page"],
			id: "eclipse.keyAssist", //$NON-NLS-0$
			callback: function() {
				if (keyAssistNode.style.display === "none") { //$NON-NLS-0$
					dojo.empty(keyAssistNode);
					if (editor) {
						dojo.place("<h2>"+messages["Editor"]+"</h2>", keyAssistNode, "last"); //$NON-NLS-1$ //$NON-NLS-0$ //$NON-NLS-3$ //$NON-NLS-2$
						var editorActions = editor.getTextView().getActions(false);
						for(var i=0; i<editorActions.length; i++) {
							var actionID = editorActions[i], actionName = actionID;
							var textView = editor.getTextView();
							var actionDescription = textView.getActionDescription(actionID);
							if (actionDescription && actionDescription.name) { actionName = actionDescription.name; }
							var bindings = textView.getKeyBindings(actionID);
							for (var j=0; j<bindings.length; j++) {
								dojo.place("<span role=\"listitem\">"+mUIUtils.getUserKeyString(bindings[j])+" = " + actionName + "<br></span>", keyAssistNode, "last"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
							}
						}
					}
					dojo.place("<h2>"+messages["Global"]+"</h2>", keyAssistNode, "last"); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
					commandService.showKeyBindings(keyAssistNode);
					keyAssistNode.style.display = "block"; //$NON-NLS-0$
				} else {
					keyAssistNode.style.display = "none"; //$NON-NLS-0$
				}
				return true;
			}});
		commandService.addCommand(keyAssistCommand);
		commandService.registerCommandContribution("globalActions", "eclipse.keyAssist", 100, null, true, new mCommands.CommandKeyBinding(191, false, true)); //$NON-NLS-1$ //$NON-NLS-0$
		if (editor) {
			var isMac = window.navigator.platform.indexOf("Mac") !== -1; //$NON-NLS-0$
			editor.getTextView().setKeyBinding(new mCommands.CommandKeyBinding(191, false, true, !isMac, isMac), keyAssistCommand.id);
			editor.getTextView().setAction(keyAssistCommand.id, keyAssistCommand.callback, keyAssistCommand);
		}
		
		userMenu.setKeyAssist(keyAssistCommand.callback);
		checkFavoritesButton(serviceRegistry, commandService);

		renderGlobalCommands(commandService);
		
		generateUserInfo(serviceRegistry);
		
		// now that footer containing progress pane is added
		startProgressService(serviceRegistry);

		//every time the user manually changes the hash, we need to load the workspace with that name
		dojo.subscribe("/dojo/hashchange", commandService, function() { //$NON-NLS-0$
			commandService.processURL(window.location.href);
		});
		
		function setTarget(target){
			target = target;
			
			dojo.query(".targetSelector").forEach(function(node, index, arr){ //$NON-NLS-0$
				node.target = target;
			});	
		}
		
		function readTargetPreference(serviceRegistry){
			serviceRegistry.registerService("orion.cm.managedservice", //$NON-NLS-0$
				{	updated: function(properties) {
						var target;
						if (properties && properties["links.newtab"] !== "undefined") { //$NON-NLS-1$ //$NON-NLS-0$
							target = properties["links.newtab"] ? "_blank" : "_self"; //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
						} else {
							target = "_self"; //$NON-NLS-0$
						}
						setTarget(target);
					}
				}, {pid: "nav.config"}); //$NON-NLS-0$
		}
		window.setTimeout(function() {readTargetPreference(serviceRegistry);}, 0);
	}
	
	//return the module exports
	return {
		generateUserInfo: generateUserInfo,
		generateRelatedLinks: generateRelatedLinks,
		generateBanner: generateBanner,
		getToolbarElements: getToolbarElements,
		layoutToolbarElements: layoutToolbarElements,
		setPageTarget: setPageTarget,
		setDirtyIndicator: setDirtyIndicator,
		setPageCommandExclusions: setPageCommandExclusions,
		notifyAuthenticationSite: notifyAuthenticationSite
	};
});
