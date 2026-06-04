# DeepSeek Balance

GNOME Shell extension that displays your [DeepSeek API](https://platform.deepseek.com/) balance in the top panel.


Shows `DeepSeek $7.78` with a green status dot. Click for a detailed breakdown.

## Features

- Current balance in the GNOME top panel (right side)
- Popup menu with per-currency breakdown (total, topped-up, granted)
- Manual refresh button
- Configurable auto-refresh interval
- **API key stored in the system keyring** (Secret Service), not plaintext

## Requirements

- GNOME Shell 50
- libsoup 3.0
- libsecret

## Install

### From source

```bash
git clone https://github.com/diasbaskara/deepseek-balance.git
cd deepseek-balance
glib-compile-schemas schemas/
cp -r . ~/.local/share/gnome-shell/extensions/deepseek-balance@diasbaskara.id
```

Press `Alt+F2`, type `r`, press `Enter` to restart GNOME Shell.

Then enable the extension:

```bash
gnome-extensions enable deepseek-balance@diasbaskara.id
```

### Set API key

Open the Extensions app (`gnome-extensions-app`), find "DeepSeek Balance", click the gear icon. Or:

```bash
gnome-extensions prefs deepseek-balance@diasbaskara.id
```

Enter your API key from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).

The key is stored in your system keyring (GNOME Keyring), not in plaintext.

## API

Uses the DeepSeek [Get User Balance](https://api-docs.deepseek.com/api/get-user-balance) endpoint:

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <token>
```

## License

MIT
