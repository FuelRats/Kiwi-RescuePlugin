/**
 * @typedef {object} RescueData
 * @type {object}
 * @property {string} id - The ID of the rescue
 * @property {string} client - The CMDR Name of the client
 * @property {string} system - The system where the client is located
 * @property {boolean} active - Shows if the rescue is active or not
 * @property {boolean} codeRed - Shows if the rescue is code red or not
 * @property {boolean} open - Shows if the rescue is open or not
 * @property {string} platform - Shows which platform the client is using (PC/Xbox)
 * @property {object} createdAt - When the rescue was created (UTC)
 * @property {object} updatedAt - When the rescue was updated (UTC)
 * @property {string} title - The title of an Epic rescue
 * @property {object} data - The meta-data of a rescue
 * @property {object} rats - The rats assigned to the rescue
 */

/**
 * @typedef {object} TPAFriendRequest
 * @type {object}
 * @property {boolean} FriendRequest - Have FR been receieved?
 * @property {string} RatID - The Rat sending the message
 * @property {string} RescueID - The rescue ID
 * @property {string} platform - Which platform this request is for
 */

/**
 * @typedef {object} TPAWingRequest
 * @type {object}
 * @property {boolean} WingRequest - Have WR been receieved?
 * @property {string} RatID - The Rat sending the message
 * @property {string} RescueID - The rescue ID
 * @property {string} platform - Which platform this request is for
 */

/**
 * @typedef {object} TPABeaconSpotted
 * @type {object}
 * @property {boolean} BeaconSpotted - Have beacon been spotted?
 * @property {string} RatID - The Rat sending the message
 * @property {string} RescueID - The rescue ID
 * @property {string} platform - Which platform this request is for
 */

/**
 * @typedef {object} RatData
 * @type {object}
 * @property {string} id - The ID of the Rat
 * @property {string} CMDRname - The CMDR Name of the rat
 * @property {string} platform - The platform of the rat
 * @property {object} createdAt - When the rat was created (UTC)
 * @property {object} updatedAt - When the rat was updated (UTC)
 */

// Polyfills JUST IN CASE.

// String.endsWith()
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function (searchStr, Position) {
    if (!(Position < this.length)) {
      Position = this.length;
    } else {
      Position |= 0;
    }
    return (
      this.substr(Position - searchStr.length, searchStr.length) === searchStr
    );
  };
}

// Array.findIndex()
// https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
if (!Array.prototype.findIndex) {
  Object.defineProperty(Array.prototype, "findIndex", {
    value: function (predicate) {
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }
      if (typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }
      var o = Object(this),
        len = o.length >>> 0,
        thisArg = arguments[1],
        k = 0;
      while (k < len) {
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return k;
        }
        k++;
      }
      return -1;
    },
  });
}

var rescuePlugin = {
  AnnouncerUrl: rescueConfig.AnnouncerUrl,
  ApiUrl: rescueConfig.ApiUrl,
  UseClientForm: true,
  TestMode: true,
  CommanderInfo: {
    CMDRName: "",
    IRCNick: "",
    EO2: null,
    System: null,
    Platform: null,
    RescueId: null,
    ExtraData: null,
  },
  UpdateInterval: 5000,
  UpdateTimer: -1,
  RescueInfo: {
    Id: null,
    Active: null,
    Client: null,
    CodeRed: null,
    Open: null,
    Notes: null,
    Platform: null,
    Successful: null,
    Epic: null,
    System: null,
    Title: null,
    CreatedAt: null,
    UpdatedAt: null,
    /** @type {object<string, RatData>} */
    Rats: {},
    UnidentifiedRats: {},
    FirstLimpet: null,
    Data: null,
    FriendReceived: false,
    WingReceived: false,
    BeaconReceived: false,
  },
  /**
   * @returns boolean
   */
  SetCommanderInfo: function () {
    SetCookie("LoginTimeStamp", new Date().getTime());

    function sanitizeCMDRName(cmdrName) {
      cmdrName = cmdrName.replace(/^cmdr/i, "").trim();
      cmdrName = cmdrName.replace(/^[@#]/i, "").trim();
      // cmdrName = transliterate(cmdrName);
      return cmdrName;
    }

    function sanitizeIRCName(cmdrName) {
      cmdrName = cmdrName.trim().replace(/^cmdr/i, "").trim();
      cmdrName = cmdrName.replace(/\s+/g, "_");
      cmdrName = cmdrName.split(" ").join("_");
      cmdrName = cmdrName.replace(/\./g, "");
      cmdrName = transliterate(cmdrName);
      cmdrName = removeDiacritics(cmdrName);
      cmdrName = cmdrName.replace(/([^A-Za-z0-9\[\]{}\^_])/g, "");
      cmdrName = cmdrName.replace(/([^A-Za-z0-9\[\]{}\^´`_\\|-]+)/g, "");
      if (cmdrName.match(/^\d+/)) {
        cmdrName = "c_" + cmdrName;
      }

      if (cmdrName.length > 30) {
        cmdrName = cmdrName.substring(0, 30);
      }
      return cmdrName;
    }

    var cmdrName = document.getElementById("server_select_nick").value;
    rescuePlugin.CommanderInfo.CMDRName = sanitizeCMDRName(cmdrName);
    rescuePlugin.CommanderInfo.IRCNick = sanitizeIRCName(cmdrName);

    document.getElementById("server_select_nick").value =
      rescuePlugin.CommanderInfo.IRCNick;

    if (rescuePlugin.CommanderInfo.IRCNick.search("client_") >= 0) {
      alert("Please enter your CMDR Name so we can help you faster!");
      return false;
    }

    rescuePlugin.CommanderInfo.System = "unknown";
    var sysItem = document.getElementById("system");
    if (sysItem !== undefined && sysItem.value.trim() !== "") {
      rescuePlugin.CommanderInfo.System = sysItem.value.trim();
    }

    if (
      rescuePlugin.CommanderInfo.System === "unknown" ||
      rescuePlugin.CommanderInfo.System.trim() === ""
    ) {
      alert(
        "Please enter which system you are located in.\nYou can find this in your left panel."
      );
      return false;
    }

    rescuePlugin.CommanderInfo.Odyssey = document.getElementById("odyssey")
      .checked
      ? true
      : false;

    rescuePlugin.CommanderInfo.Platform = "unknown";
    var platItem = document.getElementById("platform");
    if (platItem !== undefined && platItem.value.trim() !== "") {
      rescuePlugin.CommanderInfo.Platform = platItem.value.trim();
    }

    if (rescuePlugin.CommanderInfo.Platform.trim() === "") {
      alert("You must select what platform you are using.");
      return false;
    }

    rescuePlugin.CommanderInfo.EO2 = document.querySelector("#EO2").checked
      ? "NOT OK"
      : "OK";

    if (
      ((prefilledData && !prefilledData.submit) || !prefilledData) &&
      rescuePlugin.CommanderInfo.EO2 === "NOT OK"
    ) {
      alert(
        "Please log out to the main menu immediately!\nDo not forget to write down your current position!"
      );
    }

    rescuePlugin.CommanderInfo.ExtraData =
      (navigator.language
        ? "Language: " +
          getLanguageName(navigator.language) +
          " (" +
          navigator.language +
          ")"
        : "x") +
      (rescuePlugin.CommanderInfo.CMDRName !==
      rescuePlugin.CommanderInfo.IRCNick
        ? " - IRC Nickname: " + rescuePlugin.CommanderInfo.IRCNick
        : "");

    SetCookie(
      "_cmdrName",
      rescuePlugin.CommanderInfo.CMDRName,
      3600 * 24 * 365
    );
    return true;
  },
  SendAnnounceToIRC: function () {
    if (GetCookie("LoginTimeStamp") === "null") {
      DelCookie("LoginTimeStamp");
      window.onbeforeunload = null;
      top.location.href = "https://fuelrats.com/get-help";
      if (rescuePlugin.UpdateTimer !== undefined) {
        clearTimeout(rescuePlugin.UpdateTimer);
      }
      return;
    }
    var timeCheck = new Date(parseInt(GetCookie("LoginTimeStamp")));
    var diff = (new Date().getTime() - timeCheck.getTime()) / 1000;
    if (diff >= 30) {
      window.onbeforeunload = null;
      top.location.href = "https://fuelrats.com/get-help";
      if (rescuePlugin.UpdateTimer !== undefined) {
        clearTimeout(rescuePlugin.UpdateTimer);
      }
      return;
    }
    if (GetCookie("sentAnnounce") !== "null") {
      rescuePlugin.GetInitialRescueInformation(GetCookie("sentAnnounce"));
      return;
    }
    DelCookie("sentAnnounce");
    if (rescuePlugin.CommanderInfo.CMDRName !== null) {
      jQuery.ajax({
        url: rescuePlugin.AnnouncerUrl,
        type: "POST",
        dataType: "json",
        data: {
          cmdrname: rescuePlugin.CommanderInfo.CMDRName,
          EO2: rescuePlugin.CommanderInfo.EO2,
          system: rescuePlugin.CommanderInfo.System,
          platform: rescuePlugin.CommanderInfo.Platform,
          extradata: rescuePlugin.CommanderInfo.ExtraData,
          odyssey: rescuePlugin.CommanderInfo.Odyssey,
        },
        success: function () {},
      });
    }
  },
  BuildLoginForm: function (loadFromOngoingRescue) {
    var cmdrLabel, contentHolder, topPanel, infoText;

    if (rescuePlugin.UseClientForm) {
      cmdrLabel = jQuery('label[for="server_select_nick"]');
      if (cmdrLabel.length === 0) {
        setTimeout(function () {
          rescuePlugin.BuildLoginForm(loadFromOngoingRescue);
        }, 50);
        return;
      }
      cmdrLabel.text("CMDR Name");

      jQuery(".status").text("Please enter your details below...");

      var systemItem = jQuery(".system");
      if (systemItem.length === 0) {
        systemItem = jQuery(
          `<tr class="system">
    <td>
        <label for="server_select_system">System name</label>
    </td>
    <td>
        <input type="text" id="system" required="required" />
    </td>
</tr>`
        );
        cmdrLabel.parent().parent().after(systemItem);
      }

      var odysseyItem = jQuery(".odyssey");
      if (odysseyItem.length === 0) {
        odysseyItem = jQuery(
          `<tr class="odyssey">
    <td>
        <label for="server_select_odyssey">Expansion</label>
    </td>
    <td>
        <label style="font-size: .9em;">
            <select id="odyssey" value="horizons3">
              <option value="horizons3">Horizons (3.8)</option>
              <option value="horizons4">Horizons (4.0)</option>
              <option value="odyssey">Odyssey (4.0)</option>
            </select>
        </label>
    </td>
</tr>`
        );
        systemItem.after(odysseyItem);
      }

      var platformItem = jQuery(".platform");
      if (platformItem.length === 0) {
        platformItem = jQuery(
          `<tr class="platform">
    <td>
        <label for="server_select_platform">Platform</label>
    </td>
    <td>
        <select name="platform" required="required" id="platform">
            <option value="PC">PC</option>
            <option value="XB">XB</option>
            <option value="PS4">PS4</option>
        </select>
    </td>
</tr>`
        );
        systemItem.after(platformItem);
      }

      var o2Item = jQuery(".o2");
      if (o2Item.length === 0) {
        o2Item = jQuery(
          `<tr class="o2">
    <td>
        <label for="server_select_o2">Are you on emergency O2?</label>
    </td>
    <td>
        <label style="font-size: .9em;">
            <input type="checkbox" id="EO2" style="width: auto;" value="NOT OK" />
            YES! I have a timer in upper right corner.
        </label>
    </td>
</tr>`
        );
        systemItem.after(o2Item);
      }

      contentHolder = jQuery(".side_panel .content");
      jQuery(".server_select.initial").css({
        "margin-top": "155px",
        width: "620px",
      });
      topPanel = jQuery(
        '<div style="height: 150px; background-color: rgba(0,0,0,0.9); position: fixed; top: 0; left: 0; right: 0;"><img src="/kiwi/assets/plugins/FuelRats-RescuePlugin/fuelrats.png" alt="Fuel Rats" title="Fuel Rats" style="width: 138px; margin-left: 5px; margin-top: 5px;" /></div>'
      );

      if (rescuePlugin.TestMode) {
        //jQuery('.server_select.initial').css({'margin-top': '0' });
        document.styleSheets[0].insertRule(
          "#kiwi .server_select.initial:before { background: #FFFFFF !important; }",
          0
        );
        document.styleSheets[0].insertRule(
          "#kiwi button { background: #e6434b !important; color: #FFFFFF !important; }",
          0
        );
        // #e6434b
        //topPanel = jQuery(''); // append(jQuery('<span style="color: red; font-weight: bold;">TESTMODE</span>'));
      }

      contentHolder.empty();
      contentHolder.append(topPanel);

      infoText = jQuery(
        '<div style="margin: 70px 20px 1em;"><p style="font-style:italic;">Thank you for providing your information! We\'re ready to assist you on our IRC server, which you will reach by clicking the <strong>Start</strong> button to the left.<br><br>Please leave your <strong>commander name</strong> intact so we know who you are.<br><br><strong>Note:</strong> If you\'re currently in multicrew, only the ship owner needs to call for a rescue.  After you enter our IRC, you\'ll be asked to leave multicrew.</p></div>'
      );
      contentHolder.append(infoText);
      if (
        GetCookie("sentAnnounce") !== "null" &&
        loadFromOngoingRescue !== undefined &&
        loadFromOngoingRescue
      ) {
        rescuePlugin.GetInitialRescueInformation(
          GetCookie("sentAnnounce"),
          function () {
            jQuery("#server_select_nick")
              .val(rescuePlugin.RescueInfo.Client)
              .attr("readonly", "readonly");
            jQuery("#system")
              .val(rescuePlugin.RescueInfo.System)
              .attr("readonly", "readonly");
            jQuery("#platform")
              .val(rescuePlugin.RescueInfo.Platform.toUpperCase())
              .attr("disabled", "disabled");
            var eo2 = jQuery("#EO2");
            if (rescuePlugin.RescueInfo.CodeRed) {
              eo2.attr("checked", "checked");
            }
            eo2.attr("disabled", "disabled");

            var rerescueMe = jQuery(
              '<button class="rehelp-me">I need help again!</button>'
            );
            jQuery(".start button").before(rerescueMe);
            jQuery(".rehelp-me").on("click", function () {
              DelCookie("sentAnnounce");
              jQuery("#server_select_nick").removeAttr("readonly");
              jQuery("#system").removeAttr("readonly");
              jQuery("#platform").removeAttr("disabled");
              jQuery("#EO2").removeAttr("disabled");
              jQuery(".rehelp-me").remove();
              return false;
            });
          }
        );
      } else {
        if (GetCookie("_cmdrName") !== "null") {
          jQuery("#server_select_nick").val(GetCookie("_cmdrName"));
        }
      }
    } else {
      cmdrLabel = jQuery('label[for="server_select_nick"]');
      if (cmdrLabel.length === 0) {
        setTimeout(rescuePlugin.BuildLoginForm, 50);
        return;
      }
      cmdrLabel.text("CMDR Name");

      jQuery(".status").text("Please enter your details below...");

      contentHolder = jQuery(".side_panel .content");
      jQuery(".server_select.initial").css({
        "margin-top": "155px",
        width: "620px",
      });
      topPanel = jQuery(
        '<div style="height: 150px; background-color: rgba(0,0,0,0.9); position: fixed; top: 0; left: 0; right: 0;"><img src="/kiwi/assets/plugins/FuelRats-RescuePlugin/fuelrats.png" alt="Fuel Rats" title="Fuel Rats" style="width: 138px; margin-left: 5px; margin-top: 5px;" /></div>'
      );

      contentHolder.empty();
      contentHolder.append(topPanel);

      infoText = jQuery(
        '<div style="margin: 70px 20px 1em;"><p style="font-style:italic;">Thank you for providing your information! We\'re ready to make you assist our clients on our IRC server, which you will reach by clicking the <strong>Start</strong> button to the left<br /><br />Please leave your <strong>commander name</strong> intact so we know who you are</p></div>'
      );
      contentHolder.append(infoText);
    }

    jQuery(".have_pass").hide();
    jQuery(".channel").hide();
    jQuery(".show_more").hide();
    jQuery(".more").hide();
    jQuery(".startup").hide();

    jQuery(".server_select button").on("click", rescuePlugin.SetCommanderInfo);

    if (prefilledData) {
      document.getElementById("system").value = prefilledData.system ?? "";
      document.getElementById("platform").value = prefilledData.platform ?? "";
      document.getElementById("server_select_nick").value =
        prefilledData.cmdr ?? "";
      document.getElementById("EO2").checked = prefilledData.timer ?? false;
      document.getElementById("odyssey").value =
        prefilledData.odyssey ?? "horizons3";
      
      if (Date.now() - prefilledData.time < 3600000 && prefilledData.submit) {
        jQuery(".server_select button").click();
      }
    }
  },
  GetInitialRescueInformation: function (rescueId, onLoad) {
    $.ajax({
      url:
        rescuePlugin.ApiUrl +
        "/rescues" +
        (typeof rescueId == "undefined"
          ? "?client=" +
            encodeURIComponent(rescuePlugin.CommanderInfo.CMDRName) +
            "&open=true"
          : "?id=" + rescueId),
      type: "GET",
      success: function (data) {
        if (data.data.length > 0) {
          /** @type RescueData */
          var rescue = data.data[0];
          rescuePlugin.CommanderInfo.RescueId = rescue.id;

          rescuePlugin.RescueInfo.Id = rescue.id;
          rescuePlugin.RescueInfo.Active = rescue.active;
          rescuePlugin.RescueInfo.Client = rescue.client;
          rescuePlugin.RescueInfo.CodeRed = rescue.codeRed;
          rescuePlugin.RescueInfo.CreatedAt = rescue.createdAt;
          rescuePlugin.RescueInfo.System = rescue.system;
          rescuePlugin.RescueInfo.Platform = rescue.platform;
          rescuePlugin.RescueInfo.UpdatedAt = rescue.updatedAt;
          rescuePlugin.RescueInfo.Title = rescue.title;
          rescuePlugin.RescueInfo.Data = rescue.data;
          rescuePlugin.RescueInfo.Open = rescue.open;
          var rats = rescue.rats.length;
          rescuePlugin.RescueInfo.Rats = {};
          for (var i = 0; i < rats; i++) {
            rescuePlugin.RescueInfo.Rats[rescue.rats[i]] =
              rescuePlugin.FetchRatInfo(rescue.rats[i]);
          }
          jQuery("#frrpRescueWindow").appendTo(".right-bar-content");
          jQuery(".memberlists").css("bottom", "155px");
        } else {
          if (rescuePlugin.UpdateTimer !== undefined) {
            clearTimeout(rescuePlugin.UpdateTimer);
          }

          rescuePlugin.UpdateTimer = setTimeout(function () {
            rescuePlugin.GetInitialRescueInformation(undefined, onLoad);
          }, 1000);
          return;
        }
        rescuePlugin.UpdateRescueGUI();
        SetCookie("sentAnnounce", rescuePlugin.RescueInfo.Id, 3600 * 1000 * 2); // 2 hours
        if (typeof onLoad != "undefined" && typeof onLoad == "function") {
          onLoad();
        }
      },
    });
  },
  UpdateRescueGUI: function () {
    var win = jQuery("#frrpRescueWindow");
    win.empty();
    if (!rescuePlugin.RescueInfo.Open) {
      var closeInfo = jQuery(
        '<div class="closedCase">Thanks for fueling with the Rats. Make sure to stay for a moment longer as your rat will give you some invaluable information</div>'
      );
      win.append(closeInfo);
      DelCookie("sentAnnounce");
      if (rescuePlugin.UpdateTimer !== undefined) {
        clearTimeout(rescuePlugin.UpdateTimer);
      }
    } else {
      win.show();
      var cmdr = jQuery(
        '<div class="cmdrName">CMDR ' +
          rescuePlugin.RescueInfo.Client +
          "</div>"
      );
      win.append(cmdr);

      var sys = jQuery(
        '<div class="system">' + rescuePlugin.RescueInfo.System + "</div>"
      );
      win.append(sys);

      var rats = jQuery('<div class="rats"><b>Rats on mission:</b></div>');
      win.append(rats);

      var stat = jQuery('<div class="rescue-status">Initializing</div>');
      win.append(stat);

      var ratList = Object.keys(rescuePlugin.RescueInfo.Rats);
      for (var rat in ratList) {
        if (rescuePlugin.RescueInfo.Rats.hasOwnProperty(ratList[rat])) {
          var _rat = rescuePlugin.RescueInfo.Rats[ratList[rat]];
          if (_rat !== undefined) {
            jQuery(".rats").append(
              jQuery(
                "<div>" +
                  rescuePlugin.RescueInfo.Rats[ratList[rat]].CMDRname +
                  "</div>"
              )
            );
          }
        }
      }

      if (ratList.length === 0) {
        stat.text("Wait for rat assignment");
      } else {
        if (!rescuePlugin.RescueInfo.FriendReceived) {
          stat.text("Please send FR to rats");
        } else if (!rescuePlugin.RescueInfo.WingReceived) {
          stat.text("Please send WR to rats");
        } else if (!rescuePlugin.RescueInfo.BeaconReceived) {
          stat.text("Please activate beacon");
        } else {
          stat.text("Wait for rescue!");
        }
      }
    }

    if (undefined !== rescueConfig.titleBar && "" !== rescueConfig.titleBar) {
      if (jQuery("li.connection.titleBar").length === 0) {
        var titleBar = jQuery(
          '<li class="connection titleBar"><ul class="panellist"><li class="alert_activity"><span></span></li></ul></li>'
        );
        var textHolder = titleBar.find("span");
        textHolder.html(rescueConfig.titleBar);
        jQuery("ul.connections").append(titleBar);
      }
    }
  },
  FetchRatInfo: function (ratId) {
    if (rescuePlugin.CachedRats[ratId]) {
      return rescuePlugin.CachedRats[ratId];
    } else {
      /*frWs.send("rats:read", {
        id: ratId,
      });*/
    }
  },
  CachedRats: {},
  /**
   * @typedef IRCRats
   * @type {object<string, object[]>}
   */
  IRCRats: {},
  /**
   *
   * @param {Object} data - Contains the information from the API
   * @param {string} data.nick - Nickname of the user
   * @param {string} data.msg - The message that was written
   * @param {string} data.hostname - The hostname of the user that wrote
   * @param {string} data.type - The type of message receieved
   */
  ParseInput: function (data) {
    if (
      data.nick === rescuePlugin.CommanderInfo.IRCNick ||
      data.nick === "RatMama[BOT]" ||
      data.nick === "MechaSqueak[BOT]"
    ) {
      return;
    }

    if (data.type !== "message") {
      return;
    }

    if (data.msg === "!kiwi-force " + rescuePlugin.CommanderInfo.IRCNick) {
      console.log(data);

      var allowedVhosts = [
        "admin.fuelrats.com",
        ".op.fuelrats.com",
        "netadmin.fuelrats.com",
        ".overseer.fuelrats.com",
        ".techrat.fuelrats.com",
        "i.see.all",
      ];

      if (
        allowedVhosts.findIndex(function (vhost) {
          return data.hostname.endsWith(vhost);
        }) >= 0
      ) {
        window.onbeforeunload = null;
        top.location.href = "https://fuelrats.com/get-help";
      }
    }

    if (rescuePlugin.IRCRats[data.nick] == null) {
      /*frWs.searchNickName(data.nick, {
        ircmsg: data,
      });*/
    } else {
      if (rescuePlugin.IRCRats[data.nick].length > 0) {
        var rat = rescuePlugin.IRCRats[data.nick][0].rats[0];
        if (rescuePlugin.RescueInfo.Rats.hasOwnProperty(rat.id)) {
          rescuePlugin.HandleRatMessage(data);
        }
      }
    }
  },
  HandleRatMessage: function (data) {
    var msg = data.msg.toLowerCase().trim();
    if (msg.search(/fr./i) >= 0) {
      if (msg.search("fr+") >= 0) {
        rescuePlugin.RescueInfo.FriendReceived = true;
      }

      if (msg.search("fr-") >= 0) {
        rescuePlugin.RescueInfo.FriendReceived = false;
      }

      if (
        msg.search(rescuePlugin.CommanderInfo.IRCNick.toLowerCase()) >= 0 ||
        msg.search(/client/i) >= 0
      ) {
        if (msg.search(/fr\+/i) >= 0) {
          rescuePlugin.RescueInfo.FriendReceived = true;
        }

        if (msg.search(/fr-/i) >= 0) {
          rescuePlugin.RescueInfo.FriendReceived = false;
        }
      }
    }
    if (msg.search(/wr./i) >= 0) {
      if (rescuePlugin.RescueInfo.FriendReceived) {
        if (msg.search("wr+") >= 0) {
          rescuePlugin.RescueInfo.WingReceived = true;
        }

        if (msg.search("wr-") >= 0) {
          rescuePlugin.RescueInfo.WingReceived = false;
        }

        if (
          msg.search(rescuePlugin.CommanderInfo.IRCNick.toLowerCase()) >= 0 ||
          msg.search(/client/i) >= 0
        ) {
          if (msg.search(/wr\+/i) >= 0) {
            rescuePlugin.RescueInfo.WingReceived = true;
          }

          if (msg.search(/wr-/i) >= 0) {
            rescuePlugin.RescueInfo.WingReceived = false;
          }
        }
      }
    }
    if (msg.search(/bc./i) >= 0) {
      if (
        rescuePlugin.RescueInfo.FriendReceived &&
        rescuePlugin.RescueInfo.WingReceived
      ) {
        if (msg.search("bc+") >= 0) {
          rescuePlugin.RescueInfo.BeaconReceived = true;
        }

        if (msg.search("bc-") >= 0) {
          rescuePlugin.RescueInfo.BeaconReceived = false;
        }

        if (
          msg.search(rescuePlugin.CommanderInfo.IRCNick.toLowerCase()) >= 0 ||
          msg.search(/client/i) >= 0
        ) {
          if (msg.search(/bc\+/i) >= 0) {
            rescuePlugin.RescueInfo.BeaconReceived = true;
          }

          if (msg.search(/bc-/i) >= 0) {
            rescuePlugin.RescueInfo.BeaconReceived = false;
          }
        }
      }
    }

    rescuePlugin.UpdateRescueGUI();
  },
  HandleRatTracker: function (tpa) {
    console.log(tpa);
    var data;
    switch (tpa.meta.event) {
      case "CallJumps:update":
        break;
      case "FriendRequest:update":
        /** @type TPAFriendRequest */
        data = tpa.data;
        if (data.RescueID === rescuePlugin.RescueInfo.Id) {
          rescuePlugin.RescueInfo.FriendReceived = data.FriendRequest;
        }
        break;
      case "WingRequest:update":
        /** @type TPAWingRequest */
        data = tpa.data;
        if (data.RescueID === rescuePlugin.RescueInfo.Id) {
          rescuePlugin.RescueInfo.WingReceived = data.WingRequest;
        }
        break;
      case "SysArrived:update":
        break;
      case "BeaconSpotted:update":
        /** @type TPABeaconSpotted */
        data = tpa.data;
        if (data.RescueID === rescuePlugin.RescueInfo.Id) {
          rescuePlugin.RescueInfo.BeaconReceived = data.BeaconSpotted;
        }
        break;
      case "InstanceSuccessful:update":
        break;
      case "Fueled:update":
        break;
    }

    rescuePlugin.UpdateRescueGUI();
  },
  HandleTPA: function (tpa) {
    switch (tpa.meta.event) {
      case "rescue:created":
      case "rescue:updated":
        if (
          tpa.data.client === rescuePlugin.CommanderInfo.CMDRName &&
          rescuePlugin.RescueInfo.Id == null
        ) {
          rescuePlugin.GetInitialRescueInformation(tpa.data.id);
        }
        console.log(tpa);
        var rats = tpa.data.rats.length;
        for (var i = 0; i < rats; i++) {
          rescuePlugin.RescueInfo.Rats[tpa.data.rats[i]] =
            rescuePlugin.FetchRatInfo(tpa.data.rats[i]);
        }
        break;
      case "nicknames:search":
        rescuePlugin.IRCRats[tpa.meta.ircmsg.nick] = tpa.data;
        rescuePlugin.ParseInput(tpa.meta.ircmsg);
        break;
      case "rats:read":
        if (tpa.data !== undefined && tpa.data.length > 0) {
          rescuePlugin.CachedRats[tpa.data[0].id] = tpa.data[0];
        }
        break;
      case "welcome":
      case "stream:subscribe":
        break;
      default:
        if (
          typeof tpa.meta.applicationId != "undefined" &&
          tpa.meta.applicationId === "0xDEADBEEF"
        ) {
          rescuePlugin.HandleRatTracker(tpa);
          return;
        }
        console.log(tpa);
        break;
    }
  },
};

const urlParams = new URLSearchParams(window.location.search);
const prefilledDataString = urlParams.get("prefilledData");
let prefilledData = false;
if (prefilledDataString) {
  try {
    prefilledData = JSON.parse(prefilledDataString);
  } catch (e) {}
}

jQuery(document).ready(function () {
  var network = kiwi.components.Network();
  rescuePlugin.TestMode = true; //(window.location.hash && window.location.hash.substring(1) === 'testmode');
  if (rescuePlugin.UseClientForm) {
    network.on("connect", rescuePlugin.SendAnnounceToIRC);
    //frWs.init();
  }

  if (GetCookie("sentAnnounce") === "null") {
    rescuePlugin.BuildLoginForm();
  } else {
    rescuePlugin.BuildLoginForm(true);
  }
  if (rescuePlugin.UseClientForm) {
    network.on("message:message", rescuePlugin.ParseInput);
  }
  setTimeout(function () {
    rescuePlugin.UpdateRescueGUI();
  }, 500);
});

//function disableF5(e) { if ((e.which || e.keyCode) == 116) e.preventDefault(); };
//jQuery(document).on("keydown", disableF5);
