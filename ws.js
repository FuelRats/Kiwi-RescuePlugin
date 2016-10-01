var frWs = {
	conn: null,
	clientId: null,
	init: function() {
		frWs.conn = new WebSocket(rescueConfig.WSUrl);
		frWs.conn.onmessage = frWs.onMessage;
		frWs.conn.onerror = frWs.onError;
		frWs.conn.onclose = frWs.onClose;
		frWs.conn.onopen = frWs.onOpen;
	},
	onOpen: function(dc) { frWs.subscribe('0xDEADBEEF'); },
	onClose: function(dc) {
		if(dc.wasClean === false) {
			setTimeout(frWs.init, 5000);
		}
	},
	onMessage: function(data) {
		var _data = eval('d = ' + data.data);
		if(_data.meta.action == 'welcome') {
			frWs.clientId = _data.meta.id;
		}
		rescuePlugin.HandleTPA(_data);
	},
	onError: function(error) {
		console.log(error);
	},
	send: function(action, data, meta) {
		if(frWs.conn.readyState != 1) {
			if(frWs.conn.readyState == 0) {
			} else if (frWs.conn.readyState == 2 || frWs.conn.readyState == 3) {
				frWs.init();
			}
			setTimeout(function() {frWs.send(action, data, meta); }, 1000);
			return;
		}
		frWs.conn.send(JSON.stringify({ "action": action, "applicationId": frWs.clientId, "data": data, "meta": meta }));		
	},
	subscribe: function(stream) {
		frWs.conn.send(JSON.stringify({ 'action': 'stream:subscribe', 'applicationId': stream }))
	},
	searchNickName: function(nickname, meta) {
		if(frWs.conn.readyState != 1) {
			if(frWs.conn.readyState == 0) {
			} else if (frWs.conn.readyState == 2 || frWs.conn.readyState == 3) {
				frWs.init();
			}
			setTimeout(function() {frWs.searchNickName(nickname, meta); }, 1000);
			return;
		}
		frWs.conn.send(JSON.stringify({ "action": 'nicknames:search', "applicationId": frWs.clientId, "nickname": nickname, "meta": meta }));
	}
};
