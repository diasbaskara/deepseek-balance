import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Secret from 'gi://Secret?version=1';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const API_URL = 'https://api.deepseek.com/user/balance';
const SCHEMA_ID = 'org.gnome.shell.extensions.deepseek-balance';

const SecretSchema = new Secret.Schema(
    'org.gnome.shell.extensions.deepseek-balance',
    Secret.SchemaFlags.NONE,
    { purpose: Secret.SchemaAttributeType.STRING }
);
const SecretAttrs = { purpose: 'api-key' };

let balanceIndicator = null;
let refreshTimeoutId = null;
let _extension = null;

function getApiKey(settings) {
    try {
        const fromKeyring = Secret.password_lookup_sync(SecretSchema, SecretAttrs, null);
        if (fromKeyring) return fromKeyring;
    } catch (e) {}
    return settings.get_string('api-key').trim();
}

const DeepSeekIndicator = GObject.registerClass(
class DeepSeekIndicator extends PanelMenu.Button {
    _init(settings, extensionPath) {
        super._init(0, _('DeepSeek Balance'));

        this._settings = settings;
        this._balanceData = null;
        this._error = null;

        const box = new St.BoxLayout({ style_class: 'deepseek-balance-box' });

        this._icon = new St.Label({
            text: '\u25CF',
            style_class: 'deepseek-icon',
        });
        box.add_child(this._icon);

        this._label = new St.Label({
            text: '...',
            style_class: 'deepseek-balance-label',
        });
        box.add_child(this._label);

        this.add_child(box);

        this._refreshItem = new PopupMenu.PopupMenuItem(_('Refresh'));
        this._refreshItem.connect('activate', () => this._fetchBalance());
        this.menu.addMenuItem(this._refreshItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._availableItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this.menu.addMenuItem(this._availableItem);

        this._balanceItems = [];
        this._balanceSeparator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._balanceSeparator);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            if (_extension) _extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);

        this._fetchBalance();
        this._scheduleRefresh();
    }

    _scheduleRefresh() {
        if (refreshTimeoutId) {
            GLib.source_remove(refreshTimeoutId);
            refreshTimeoutId = null;
        }
        const interval = this._settings.get_int('refresh-interval');
        const seconds = Math.max(1, interval) * 60;
        refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._fetchBalance();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _fetchBalance() {
        const apiKey = getApiKey(this._settings);
        if (!apiKey) {
            this._setError(_('No API key set'));
            return;
        }

        const session = new Soup.Session({ timeout: 15 });
        const message = Soup.Message.new('GET', API_URL);
        message.request_headers.append('Authorization', 'Bearer ' + apiKey);
        message.request_headers.append('Accept', 'application/json');

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.status_code !== Soup.Status.OK) {
                    this._setError('HTTP ' + message.status_code);
                    return;
                }
                const data = JSON.parse(new TextDecoder('utf-8').decode(bytes.get_data()));
                this._balanceData = data;
                this._error = null;
                this._updateDisplay();
            } catch (e) {
                this._setError(e.message);
            }
        });
    }

    _setError(msg) {
        this._balanceData = null;
        this._error = msg;
        this._label.text = 'DeepSeek N/A';
        this._icon.visible = false;
        this._updateMenuError(msg);
    }

    _updateDisplay() {
        if (!this._balanceData) return;

        const infos = this._balanceData.balance_infos || [];

        if (infos.length === 0) {
            this._label.text = 'DeepSeek 0.00';
            this._icon.visible = this._balanceData.is_available;
            return;
        }

        const primary = infos[0];
        const sym = primary.currency === 'USD' ? '$' : '\u00A5';
        this._label.text = 'DeepSeek ' + sym + primary.total_balance;

        this._icon.visible = true;

        this._updateMenu(infos);
    }

    _updateMenu(infos) {
        for (const item of this._balanceItems) item.destroy();
        this._balanceItems = [];

        this._availableItem.label.text = this._balanceData.is_available
            ? _('Status: Available')
            : _('Status: Insufficient balance');

        for (const info of infos) {
            const sym = info.currency === 'USD' ? '$' : '\u00A5';
            const item = new PopupMenu.PopupMenuItem(
                info.currency + ': Total ' + sym + info.total_balance +
                '  |  Topped-up ' + sym + info.topped_up_balance +
                '  |  Granted ' + sym + info.granted_balance,
                { reactive: false }
            );
            this._balanceItems.push(item);
            this.menu.addMenuItem(item);
        }
        this._balanceSeparator.visible = infos.length > 0;
    }

    _updateMenuError(msg) {
        for (const item of this._balanceItems) item.destroy();
        this._balanceItems = [];
        this._availableItem.label.text = _('Error: ') + msg;
        this._balanceSeparator.visible = false;
    }

    vfunc_destroy() {
        if (refreshTimeoutId) {
            GLib.source_remove(refreshTimeoutId);
            refreshTimeoutId = null;
        }
        super.vfunc_destroy();
    }
});

export default class DeepSeekBalanceExtension extends Extension {
    enable() {
        _extension = this;
        balanceIndicator = new DeepSeekIndicator(
            this.getSettings(SCHEMA_ID), this.path
        );
        Main.panel.addToStatusArea('deepseek-balance', balanceIndicator, 0, 'right');
    }

    disable() {
        if (balanceIndicator) {
            balanceIndicator.destroy();
            balanceIndicator = null;
        }
        _extension = null;
    }
}
