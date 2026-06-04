import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Secret from 'gi://Secret?version=1';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SecretSchema = new Secret.Schema(
    'org.gnome.shell.extensions.deepseek-balance',
    Secret.SchemaFlags.NONE,
    { purpose: Secret.SchemaAttributeType.STRING }
);
const SecretAttrs = { purpose: 'api-key' };
const SCHEMA_ID = 'org.gnome.shell.extensions.deepseek-balance';

function getApiKey() {
    try {
        const fromKeyring = Secret.password_lookup_sync(SecretSchema, SecretAttrs, null);
        if (fromKeyring) return fromKeyring;
    } catch (e) {}
    return '';
}

function setApiKey(key) {
    if (key) {
        Secret.password_store_sync(SecretSchema, SecretAttrs, Secret.COLLECTION_DEFAULT,
            'DeepSeek API Key', key, null);
    } else {
        Secret.password_clear_sync(SecretSchema, SecretAttrs, null);
    }
}

function maskKey(k) {
    if (!k || k.length <= 8) return k || '\u2014';
    return k.slice(0, 5) + '\u2022'.repeat(14) + k.slice(-4);
}

export default class DeepSeekBalancePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SCHEMA_ID);

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: _('DeepSeek API'),
            description: _('API key is stored securely in your system keyring.'),
        });
        page.add(group);

        let realKey = getApiKey() || settings.get_string('api-key');

        // Read-only masked key display + change button
        const keyRow = new Adw.ActionRow({
            title: _('API Key'),
            subtitle: maskKey(realKey),
        });

        const changeBtn = new Gtk.Button({
            label: _('Change\u2026'),
            valign: Gtk.Align.CENTER,
        });
        changeBtn.add_css_class('flat');
        changeBtn.connect('clicked', () => {
            const dialog = new Adw.MessageDialog({
                transient_for: window,
                heading: _('Change API Key'),
                body: _('Enter a new DeepSeek API key.'),
                close_response: 'cancel',
            });

            const entry = new Gtk.Entry({
                placeholder_text: _('Paste new API key here'),
                visibility: false,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });
            dialog.set_extra_child(entry);

            dialog.add_response('cancel', _('Cancel'));
            dialog.add_response('save', _('Save'));
            dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);

            dialog.connect('response', (dlg, response) => {
                if (response === 'save') {
                    const newKey = entry.get_text().trim();
                    if (newKey) {
                        realKey = newKey;
                        setApiKey(realKey);
                        settings.set_string('api-key', realKey);
                        keyRow.set_subtitle(maskKey(realKey));
                    }
                }
                dlg.destroy();
            });

            dialog.present();
        });
        keyRow.add_suffix(changeBtn);
        group.add(keyRow);

        const refreshRow = new Adw.SpinRow({
            title: _('Refresh Interval (minutes)'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 1440,
                step_increment: 1,
            }),
            value: settings.get_int('refresh-interval'),
        });
        refreshRow.connect('changed', (row) => {
            settings.set_int('refresh-interval', row.get_value());
        });
        group.add(refreshRow);

        window.add(page);
    }
}
