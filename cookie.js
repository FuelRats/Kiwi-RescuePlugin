var CookieBase = 'FuelRats';

function GetCookie(name) {
	try {
		var cookie = document.cookie;
		name = CookieBase + name;
		var valueStart = cookie.indexOf(name + "=") + 1;
		if (valueStart === 0) {
			return nil;
		}
		valueStart += name.length;
		var valueEnd = cookie.indexOf(";", valueStart);
		if (valueEnd == -1)
			valueEnd = cookie.length;
		return decodeURIComponent(cookie.substring(valueStart, valueEnd));
	} catch (e) {
		;
	}
	return "null";
}

function SetCookie(name, value, expire) {
	var temp = 
		CookieBase + 
		name + "=" + escape(value) + 
		(expire !== 0 ? 
			"; path=/; expires=" + ((new Date((new Date()).getTime() + expire)).toUTCString()) + ";" : 
			"; path=/;"
		);
	document.cookie = temp;
}

function CanSetCookies() {
	SetCookie('_frrpCookieTest', 'true', 0);
	var can = GetCookie('_frrpCookieTest') != "null";
	DelCookie('_frrpgCookieTest');
	return can;
}

function DelCookie(name) {
	document.cookie = CookieBase + name + '=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

	jQuery.ajax({
		url: '/kiwi/assets/plugins/FuelRats-RescuePlugin/fuelrats.png',
		async: false,
		success: function() { }
	});
}
