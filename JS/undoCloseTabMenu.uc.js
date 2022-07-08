// ==UserScript==
// @name          undoCloseTabMenu.uc.js
// @include       main
// @charset       UTF-8
// ==/UserScript==
(function(doc) {

	var refNode = doc.getElementById('tabContextMenu');
	var menu = doc.createXULElement('menu');
	menu.setAttribute('id', 'context_undoCloseTabMenu');
	menu.setAttribute('label', '最近閉じたタブ'); //'Recently Closed Tabs'
	menu.setAttribute('class', 'menu-iconic');
	menu.setAttribute('image', 'chrome://global/skin/icons/undo.svg');
	refNode.appendChild(menu);
	
	if (!sep) {
		var sep = doc.createXULElement('menuseparator');
		sep.setAttribute('id', 'undoCloseTabMenu-sep');
		var insPos = doc.getElementById('context_undoCloseTabMenu');
		refNode.insertBefore(sep, insPos);
	}

	var popup = doc.createXULElement('menupopup');
	menu.addEventListener('popupshowing', function() {
		while (popup.hasChildNodes()) {
			popup.removeChild(popup.firstChild);
		}
		var utils = RecentlyClosedTabsAndWindowsMenuUtils;
		var tabsFragment = utils.getTabsFragment(window, 'menuitem');
		popup.appendChild(tabsFragment);
	}, false);
	menu.appendChild(popup);

}(document));
