import React from 'react';
import {
  Platform
} from 'react-native';
import { Notifications } from 'expo';

import SQLite from "react-native-sqlite-2";

import MetaStorage from 'src/singletons/MetaStorage';

import GLOBALS from 'src/Globals';

// FeedDB Helper Function
const FeedDBHelper = {
  // To Get DB Connection
  getDB: function () {
    const db = SQLite.openDatabase(
      "feedDB.db",
      "1.0",
      "Feed DB",
      1,
      FeedDBHelper.openCB,
      FeedDBHelper.errorCB
      );
    return db;
  },
  // To Get the table name
  getTable: function() {
    const tableName = "feed";
    return tableName;
  },
  // To Create Table, can also be used to purge
  createTable: function () {
    const db = FeedDBHelper.getDB();
    const table = FeedDBHelper.getTable();

    // Prepare statement
    const nid = "nid INTEGER PRIMARY KEY NOT NULL";
    const sid = "sid INTEGER";
    const type = "type INTEGER NOT NULL";
    const app = "app TEXT NOT NULL";
    const icon = "icon TEXT NOT NULL";
    const url = "url TEXT NOT NULL";
    const appbot = "appbot BOOL";
    const secret = "secret INTEGER";
    const asub = "asub TEXT";
    const amsg = "amsg TEXT NOT NULL";
    const acta = "acta TEXT";
    const aimg = "aimg TEXT";
    const hidden = "hidden INTEGER";
    const epoch = "epoch INTEGER";

    const dropTable = `DROP TABLE IF EXISTS ${table}`;
    const createTable = `CREATE TABLE IF NOT EXISTS ${table} (${nid}, ${sid}, ${type}, ${app}, ${icon}, ${url}, ${appbot}, ${secret}, ${asub}, ${amsg}, ${acta}, ${aimg}, ${hidden}, ${epoch})`;

    db.transaction(function(txn) {
      txn.executeSql(
        dropTable,
        [],
        FeedDBHelper.successCB,
        FeedDBHelper.errorCB
      );
      txn.executeSql(
        createTable,
        [],
        FeedDBHelper.successCB,
        FeedDBHelper.errorCB
      );
    });
  },
  // To get Feeds, return Object of Objects
  getFeeds: async function(db, startIndex, numRows) {
    // RETURN ARRAY OF OBJECTS (JSON) or empty array if no feed remaining
    // JSON FORMAT OF OBJECT
    // {
    //   notificationID: String
    //   notificationType: Integer (1 - normal notification, 2 - encrypted)
    //   appName: String
    //   appIcon: String
    //   appURL: String
    //   appbot: Bool
    //   secret: String (is the encrypted secret that needs to be used to decrypt msgData if notification type is 2)
    //   msgData: JSON String, can be encrypted or unencrpyted as per notificationType
    //   timeInEpoch: Integer
    // }

    const table = FeedDBHelper.getTable();

    let response = [];

    // Prepare statement
    const query = `SELECT * FROM ${table} WHERE hidden=0 ORDER BY epoch DESC LIMIT ${startIndex}, ${numRows}`;
    const res = await FeedDBHelper.runQuery(db, query, response);

    const feedItems = res.rows;
    for (let i = 0; i < feedItems.length; ++i) {

      const feedItem = feedItems.item(i);

      // Create object
      let obj = {
        notificationID: feedItem.nid,
        serverID: feedItem.sid,
        notificationType: feedItem.type,
        appName: feedItem.app,
        appIcon: feedItem.icon,
        appURL: feedItem.url,
        appbot: feedItem.appbot,
        secret: feedItem.secret,
        asub: feedItem.asub,
        amsg: feedItem.amsg,
        acta: feedItem.acta,
        aimg: feedItem.aimg,
        timeInEpoch: feedItem.epoch,
      };

      response.push(obj);
    }

    return response;
  },
  // To Add Feed coming from Notification or Appbot
  addFeedFromPayload: function(
    sidV, typeV, appV, iconV, urlV, appbotV, secretV, asubV, amsgV, actaV, aimgV, hiddenV, epochV
  ) {

    FeedDBHelper.addRawFeed(
      sidV, typeV, appV, iconV, urlV, appbotV, secretV, asubV, amsgV, actaV, aimgV, hiddenV, epochV
    );
  },
  // To Add Raw Feed
  addRawFeed: async function(
    sidV, typeV, appV, iconV, urlV, appbotV, secretV, asubV, amsgV, actaV, aimgV, hiddenV, epochV
  ) {
    // Everything is assumed as string so convert them if undefined
    sidV = sidV == undefined ? 0 : parseInt(sidV);
    typeV = typeV == undefined ? 0 : parseInt(typeV);
    appV = appV == undefined ? '' : appV;
    iconV = iconV == undefined ? '' : iconV;
    urlV = urlV == undefined ? '' : urlV;
    appbotV = (appbotV == undefined || parseInt(appbotV) == 0) ? 0 : 1;
    secretV = secretV == undefined ? '' : secretV;
    asubV = asubV == undefined ? '' : asubV;
    amsgV = amsgV == undefined ? '' : amsgV;
    actaV = actaV == undefined ? '' : actaV;
    aimgV = aimgV == undefined ? '' : aimgV;
    hiddenV = (hiddenV == undefined || parseInt(hiddenV) == 0) ? 0 : 1;
    epochV = epochV == undefined ? (parseInt(new Date().getTime()) / 1000) : parseInt(epochV);

    // Checks first
    let shouldProceed = true;
    if (
      appV.length == 0
      || iconV.length == 0
      || urlV.length == 0
      || amsgV.length == 0
    ) {
      shouldProceed = false;
    }

    // DB Related
    const db = FeedDBHelper.getDB();
    const table = FeedDBHelper.getTable();

    // prepare
    const sid = "sid";
    const type = "type";
    const app = "app";
    const icon = "icon";
    const url = "url";
    const appbot = "appbot";
    const secret = "secret";
    const asub = "asub";
    const amsg = "amsg";
    const acta = "acta";
    const aimg = "aimg";
    const hidden = "hidden";
    const epoch = "epoch";

    const insertRows = `${sid}, ${type}, ${app}, ${icon}, ${url}, ${appbot}, ${secret}, ${asub}, ${amsg}, ${acta}, ${aimg}, ${hidden}, ${epoch}`;

    const query = `INSERT INTO ${table} (${insertRows}) VALUES (${sidV}, ${typeV}, '${appV}', '${iconV}', '${urlV}', ${appbotV}, '${secretV}', '${asubV}', '${amsgV}', '${actaV}', '${aimgV}', ${hiddenV}, ${epochV})`;

    if (shouldProceed) {
      const res = await FeedDBHelper.runQuery(db, query);

      if (res) {
        // Finally update badge
        const currentBadge = await MetaStorage.instance.getBadgeCount();
        await MetaStorage.instance.setBadgeCount(currentBadge + 1);

        // And iOS Badge as well
        if (Platform.OS ===  "ios") {

        }
      }
      else {
        shouldProceed = false;
      }
    }

    if (!shouldProceed) {
      console.log("Valdiation Failed!!!");
      console.log("--------------------");

      console.log("sid ==> '" + sidV + "' (" + typeof(sidV) + ")");
      console.log("type ==> '" + typeV + "' (" + typeof(typeV) + ")");
      console.log("app ==> '" + appV + "' (" + typeof(appV) + ")" + "(Length: " + appV.length + ")");
      console.log("icon ==> '" + iconV + "' (" + typeof(iconV) + ")" + "(Length: " + iconV.length + ")");
      console.log("url ==> '" + urlV + "' (" + typeof(urlV) + ")" + "(Length: " + urlV.length + ")");
      console.log("appbot ==> '" + appbotV + "' (" + typeof(appbotV) + ")");
      console.log("secret ==> '" + secretV + "' (" + typeof(secretV) + ")");
      console.log("asub ==> '" + asubV + "' (" + typeof(asubV) + ")");
      console.log("amsg ==> '" + amsgV + "' (" + typeof(amsgV) + ")" + "(Length: " + amsgV.length + ")");
      console.log("acta ==> '" + actaV + "' (" + typeof(actaV) + ")");
      console.log("aimg ==> '" + aimgV + "' (" + typeof(aimgV) + ")");
      console.log("hidden ==> '" + hiddenV + "' (" + typeof(hiddenV) + ")");
      console.log("epoch ==> '" + epochV + "' (" + typeof(epochV) + ")");
    }
  },
  // To add Feed from Internal Payload
  addFeedFromInternalPayload: function(payload) {
    FeedDBHelper.addRawFeed(
      payload.sid,
      payload.type,
      payload.app,
      payload.icon,
      payload.url,
      payload.appbot,
      payload.secret,
      payload.sub,
      payload.msg,
      payload.img,
      payload.cta,
      payload.hidden,
      payload.epoch,
    );
  },
  // To add a specific feed
  hideFeed: function(nid) {
    const db = FeedDBHelper.getDB();
    const table = FeedDBHelper.getTable();

    // prepare
    const statement = `UPDATE ${table} SET hidden=TRUE WHERE nid=${nid}`;

    db.transaction(function(txn) {
      txn.executeSql(
        statement,
        [],
        FeedDBHelper.successCB,
        FeedDBHelper.errorCB
      );
    });
  },
  // to unhide all feeds
  unhideAllFeeds: function() {
    const db = FeedDBHelper.getDB();
    const table = FeedDBHelper.getTable();

    // prepare
    const statement = `UPDATE ${table} SET hidden=0 WHERE hidden=1`;

    db.transaction(function(txn) {
      txn.executeSql(
        statement,
        [],
        FeedDBHelper.successCB,
        FeedDBHelper.errorCB
      );
    });
  },
  // to delete specific feed
  deleteFeed: function(nid) {
    const db = FeedDBHelper.getDB();
    const table = FeedDBHelper.getTable();

    // prepare
    const statement = `DELETE FROM ${table} WHERE nid=${nid}`;
    db.transaction(function(txn) {
      txn.executeSql(
        statement,
        [],
        FeedDBHelper.successCB,
        FeedDBHelper.errorCB
      );
    });
  },
  // to create dummy feed
  createDummyFeed: function() {

  },
  // Helper Function to validate item, check empty, trim, null, etc
  validateItem: (item) => {
    const str = item.trim();
    return (str && str.length > 0);
  },
  // Helper function to return promise of sql statement, 1 transaction only
  runQuery(db, query, args = []) {
      return new Promise((resolve, reject) => {
        db.transaction(async (tx) => {
          tx.executeSql(query, args, (tx, res) => resolve(res), reject);
        });
      });
    }
  ,
  // Logging and testing functions below
  addLog: (msg, info) => {
    console.log(msg)

    if (info) {
      console.log(info);
    }
  },
  // error callback
  errorCB: (err) => {
    console.error('error:', err)
    FeedDBHelper.addLog('Error: ', (err.message || err))

    return false
  },
  // On success callback
  successCB: () => {
    FeedDBHelper.addLog('SQL Executed...')
  },
  // On open callback
  openCB: () => {
    FeedDBHelper.addLog('Database OPEN')
  },
}

export default FeedDBHelper;