# k9s

Kubernetes cluster management from the terminal.

## Skin

Gruvbox Dark (`skins/gruvbox-dark.yaml`). A light variant is also available at `skins/gruvbox-light.yaml`. Active skin is set in `config.yaml`.

## Resource Aliases

Defined in `aliases.yaml`:

| Alias | Resource |
|---|---|
| `dp` | deployments |
| `sec` | v1/secrets |
| `jo` | jobs |
| `cr` | clusterroles |
| `crb` | clusterrolebindings |
| `ro` | roles |
| `rb` | rolebindings |
| `np` | networkpolicies |

## Config

`config.yaml` sets the log tail to 10,000 lines and pins the active skin to `gruvbox-dark`.
