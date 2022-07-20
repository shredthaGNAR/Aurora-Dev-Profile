// ==UserScript==
// @name                newTabByLongPress.uc.js
// @description         ブックマーク(サイドバー含む)を左クリック長押しで新しいタブに開く
// @include             main
// @version             0.8.6  些細な修正
// @version             0.8.5  サイドバーで動作していなかったのを修正
// @version             0.8.4  ブックマーク専用仕様に変更
// ==/UserScript==
(function () {
	'use strict';

	const WAIT = 280; // 長押しと判定するまでの時間
	const IN_BACKGROUND = true; // タブを背面に開くか
	const RELATED_TO_CURRENT = true; // ブックマーク)現在のタブの右隣に開くか

	var timeoutID;
	var longPress = false;

	function handleLongPress (event) {
		if (timeoutID) {
			clearTimeout(timeoutID);
			timeoutID = null;
		}

		if (event.button !== 0) return;
		if (event.altKey || event.ctrlKey || event.shiftKey) return;

		var node = event.target || event.originalTarget;
		if (!checkNode(node)) return;
		
		var url = getPlacesURI(event, node);
		if (!url) return;

		if (event.type === 'mousedown') {
			timeoutID = setTimeout(function () {
				addEventListener('click', function clk(event) {
					removeEventListener('click', clk, true);
					event.preventDefault();
					event.stopPropagation();
				}, true);
				gBrowser.loadOneTab(url, {
					relatedToCurrent: RELATED_TO_CURRENT,
					inBackground: IN_BACKGROUND,
					referrerURI: makeURI(gBrowser.currentURI.spec),
					triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({})
				});
				longPress = true;
			}, WAIT);
		} else {
			clearTimeout(timeoutID);
			if (longPress && event.type === 'mouseup') {
				event.preventDefault();
				longPress = false;
			}
		}
	}

	function checkNode (node) {
		if (!node || !node.localName) {
			return;
		}
		var ln = node.localName.toLowerCase();
		return (node._placesNode && PlacesUtils.nodeIsURI(node._placesNode)
			|| (ln === 'treechildren' && (isBookmarkTree(node.parentNode)
			|| isHistoryTree(node.parentNode))))
	}
	
	function getPlacesURI (event, node) {
		var ln = node.localName.toLowerCase();
		return (ln === 'treechildren') ? getTreeInfo(event, node).uri : node._placesNode.uri;
	}

	function getTreeInfo (event, node) {
		if (!('PlacesUtils' in window)) {
			return '';
		}
		var treechildren = node;
		if (treechildren.localName !== 'treechildren') {
			return;
		}
		var tree = treechildren.parentNode;
		var cell = tree.getCellAt(event.clientX, event.clientY);
		if (cell.row === -1) {
			return '';
		}
		var url = tree.view.nodeForTreeIndex(cell.row);
		if (!url || !PlacesUtils.nodeIsURI(url)) {
			return '';
		}
		return url;
	}

	function isBookmarkTree(tree) {
		return /[:&]folder=/.test(tree.getAttribute('place'));
	}

	function isHistoryTree(tree) {
		var place = tree.getAttribute('place');
		return !/[:&]folder=/.test(place)
			&& !/[:&]transition=7(?:&|$)/.test(place);
	}

	['mousedown', 'mouseup', 'dragstart'].forEach(function (type) {
		addEventListener(type, handleLongPress, true);
	});

}());
