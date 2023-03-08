/** 
 * A user manager component. Needs corresponding backend api.
 * (C) 2021 TekMonks. All rights reserved.
 * License: See enclosed license file.
 */
import {util} from "/framework/js/util.mjs";
import {i18n} from "/framework/js/i18n.mjs";
import {router} from "/framework/js/router.mjs";
import {session} from "/framework/js/session.mjs";
import "./subcomponents/dialog-box/dialog-box.mjs";
import "./subcomponents/context-menu/context-menu.mjs";
import {apimanager as apiman} from "/framework/js/apimanager.mjs";
import {monkshu_component} from "/framework/js/monkshu_component.mjs";

const CONTEXT_MENU_ID = "usermanagerContextMenu", API_GETORGUSERS = "getorgusers", API_DELETEUSER = "deleteuser",
	API_APPROVEUSER = "approveuser", API_EDITUSER = "updateuserbyadmin", API_RESETUSER = "resetuser", 
	API_ADDUSER = "adduserbyadmin", COMPONENT_PATH = util.getModulePath(import.meta);

let conf, mustache_instance;

async function elementConnected(element) {
	conf = await $$.requireJSON(`${COMPONENT_PATH}/conf/usermanager.json`);

	const usersResult = await apiman.rest(`${element.getAttribute("backendurl")}/${API_GETORGUSERS}`, "GET", 
		{org: element.getAttribute("org")}, true);
	if (!usersResult.result) {LOG.error("Can't fetch the list of users for the org, API returned false.");}

	const users = usersResult?.users||[], data = _createData(element, users);
	user_manager.setDataByHost(element, data);

	user_manager.getMemory(element.id).users = users;

	if (!mustache_instance) mustache_instance = await router.getMustache();
}

async function elementRendered(host, initialRender) {	// for some weird reason we need to set value via JS only
	const memory = user_manager.getMemory(host.id);
	if (!initialRender && memory.filter) user_manager.getShadowRootByHost(host).querySelector("input#searchbox").value = memory.filter;
}

async function searchModified(element) {
	const filter = element.value.trim(), memory = user_manager.getMemoryByContainedElement(element), 
		users = memory.users, filteredUsers = [];

	if (filter != "") {
		for (const user of users) if (user.name.toLowerCase().includes(filter.toLowerCase()) || 
			user.id.toLowerCase().includes(filter.toLowerCase())) filteredUsers.push(user);
	} else filteredUsers.push(...users);

	const data = _createData(user_manager.getHostElement(element), filteredUsers); memory.filter = filter;
	await user_manager.bindData(data, user_manager.getHostElementID(element));
}

async function userMenuClicked(event, element, name, id, _org, role, approved) {
	const CONTEXT_MENU = window.monkshu_env.components["context-menu"];
	const menus = {}; menus[await i18n.get("Edit")] = _=>editUser(name, id, role, approved, element); 
	menus[await i18n.get("Delete")] = _ => _deleteUser(name, id, element); menus[await i18n.get("Reset")] = _ => _resetUser(name, id, element);
	if (approved == 0) menus[await i18n.get("Approve")] = _=>_approveUser(name, id, element);
	CONTEXT_MENU.showMenu(CONTEXT_MENU_ID, menus, event.pageX, event.pageY, 2, 2);
}

async function addUser(element) {
	const roles = []; for (const thisrole of conf.roles) roles.push({label:await i18n.get(thisrole), value: thisrole, selected: thisrole==conf.user_role?true:undefined});
	monkshu_env.components['dialog-box'].showDialog(`${COMPONENT_PATH}/dialogs/addeditprofile.html`, true, true, 
			{approved: true, roles, CONF:conf}, "dialog", ["name", "id", "role", "approved"], async ret => {
		
		if (ret.approved.toLowerCase() == "true") ret.approved = true; else ret.approved = false;
		ret.org = session.get(conf.userorg_session_variable); ret.lang = i18n.getSessionLang();
		const backendURL = user_manager.getHostElement(element).getAttribute("backendurl");
		const addResult = await apiman.rest(`${backendURL}/${API_ADDUSER}`, "POST", ret, true);

		if (!addResult?.result) {	// account creation failed
			const err = mustache_instance.render(await i18n.get("AddError"), {name: ret.name, id: ret.id}); 
			LOG.error(err); monkshu_env.components['dialog-box'].hideDialog("dialog"); _showMessage("dialog", err);
		} else if (!addResult.emailresult) {	// account created but login email send failed
			const err = mustache_instance.render(await i18n.get("AddEmailError"), {name: ret.name, id: ret.id, loginurl: addResult.loginurl}); 
			LOG.error(err); monkshu_env.components['dialog-box'].hideDialog("dialog"); _showError(err);
		} else monkshu_env.components['dialog-box'].hideDialog("dialog");

		user_manager.reload(user_manager.getHostElementID(element));
	});
}

async function editUser(name, id, role, approved, element) {
	const roles = []; for (const thisrole of conf.roles) roles.push({label:await i18n.get(thisrole), value: thisrole, selected: thisrole==role?true:undefined});
	monkshu_env.components['dialog-box'].showDialog(`${COMPONENT_PATH}/dialogs/addeditprofile.html`, true, true, 
			{name, id, role, approved:approved==1?true:undefined, roles, CONF:conf, 
				doNotAllowApproval:id==session.get(conf.userid_session_variable)?true:undefined}, "dialog", 
			["name", "id", "role", "approved", "old_id"], async ret => {
		
		if (ret.approved.toLowerCase() == "true") ret.approved = true; else ret.approved = false;
		const backendURL = user_manager.getHostElement(element).getAttribute("backendurl");
		const editResult = await apiman.rest(`${backendURL}/${API_EDITUSER}`, "POST", ret, true);
		if (!editResult?.result) {
			const err = mustache_instance.render(await i18n.get("EditError"), {name, id}); 
			LOG.error(err); monkshu_env.components['dialog-box'].error("dialog", err);
		} else {
			monkshu_env.components['dialog-box'].hideDialog("dialog");
			user_manager.reload(user_manager.getHostElementID(element));
		}
	});
}

async function _deleteUser(name, id, element) {
	const host = user_manager.getHostElement(element), logoutcommand = host.getAttribute("logoutcommand"), backendURL = host.getAttribute("backendurl");
	_execOnConfirm(mustache_instance.render(await i18n.get("ConfirmUserDelete"), {name, id}), async _ =>{
		const deleteResult = await apiman.rest(`${backendURL}/${API_DELETEUSER}`, "GET", {name, id}, true);
		if (!deleteResult?.result) {const err = mustache_instance.render(await i18n.get("DeleteError"), {name, id}); LOG.error(err); _showError(err);}
		else {
			if (id==session.get(conf.userid_session_variable) && logoutcommand) eval(logoutcommand);	// user deleted themselves, logout!
			else user_manager.reload(user_manager.getHostElementID(element));	// reload user list
		}
	});
}

async function _resetUser(name, id, element) {
	_execOnConfirm(mustache_instance.render(await i18n.get("ConfirmUserReset"), {name, id}), async _ =>{
		const backendURL = user_manager.getHostElement(element).getAttribute("backendurl"), lang = i18n.getSessionLang();
		const resetResult = await apiman.rest(`${backendURL}/${API_RESETUSER}`, "GET", {id, lang}, true);
		if (!resetResult?.result) {const err = mustache_instance.render(await i18n.get("ResetError"), {name, id}); LOG.error(err); _showError(err);}
		else _showMessage(await i18n.get("ResetSuccess"));
	});
}

async function _approveUser(name, id, element) {
	const backendURL = user_manager.getHostElement(element).getAttribute("backendurl");
	const approveResult = await apiman.rest(`${backendURL}/${API_APPROVEUSER}`, "GET", {id}, true);
	if (!approveResult?.result) {
		const err = mustache_instance.render(await i18n.get("ApproveError"), {name, id}); 
		LOG.error(err); _showError(err);
	} else { 
		await _showMessage(mustache_instance.render(await i18n.get("Approved"), {name, id})); 
		user_manager.reload(user_manager.getHostElementID(element)); 
	}
}

function _createData(host, users) {
	const data = {componenturl: COMPONENT_PATH, CONTEXT_MENU_ID};

	if (host.getAttribute("styleBody")) data.styleBody = `<style>${host.getAttribute("styleBody")}</style>`;
	if (users) data.users = users;
	data.CONF = conf;

	return data;
}

const _showError = async error => { await monkshu_env.components['dialog-box'].showDialog(`${COMPONENT_PATH}/dialogs/error.html`, 
	true, false, {error, CONF:conf}, "dialog", []); monkshu_env.components['dialog-box'].hideDialog("dialog"); }
const _showMessage = async message => { await monkshu_env.components['dialog-box'].showDialog(`${COMPONENT_PATH}/dialogs/message.html`, 
	true, false, {message, CONF:conf}, "dialog", []); monkshu_env.components['dialog-box'].hideDialog("dialog"); }
const _execOnConfirm = (message, cb) => monkshu_env.components['dialog-box'].showDialog(`${COMPONENT_PATH}/dialogs/message.html`, 
	true, true, {message, CONF:conf}, "dialog", [], _=>{monkshu_env.components['dialog-box'].hideDialog("dialog"); cb();});

export const user_manager = {trueWebComponentMode: true, elementConnected, userMenuClicked, addUser, editUser, 
	searchModified, elementRendered}
monkshu_component.register("user-manager", `${COMPONENT_PATH}/user-manager.html`, user_manager);