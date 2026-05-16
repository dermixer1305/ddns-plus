#!/usr/bin/env bash
set -Eeuo pipefail

lApp="DDNS+"
lInstallDir="${DDNS_PLUS_INSTALL_DIR:-/opt/ddns-plus}"
lRepoUrl="${DDNS_PLUS_REPO:-https://github.com/dermixer1305/ddns-plus.git}"
lBranch="${DDNS_PLUS_BRANCH:-main}"
lPort="${DDNS_PLUS_PORT:-3000}"
lSessionSecret="${DDNS_PLUS_SESSION_SECRET:-}"
lServiceUser="ddns-plus"

function l_log() {
  echo "[DDNS+] $*"
}

function l_fail() {
  echo "[DDNS+] ERROR: $*" >&2
  exit 1
}

if [[ "$(id -u)" -ne 0 ]]; then
  l_fail "This installer must run as root inside the LXC container."
fi

if [[ -z "${lSessionSecret}" ]]; then
  lSessionSecret="$(openssl rand -hex 32)"
fi

export DEBIAN_FRONTEND=noninteractive

l_log "Updating operating system"
apt-get update
apt-get dist-upgrade -y

l_log "Installing base dependencies"
apt-get install -y ca-certificates curl git openssl sqlite3 sudo

l_log "Installing Node.js 24 LTS"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

l_log "Creating service user"
if ! id "${lServiceUser}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${lServiceUser}"
fi

l_log "Preparing installation directory"
mkdir -p "${lInstallDir}"
chown "${lServiceUser}:${lServiceUser}" "${lInstallDir}"

if [[ ! -d "${lInstallDir}/.git" ]]; then
  l_log "Cloning ${lApp}"
  sudo -u "${lServiceUser}" git clone --branch "${lBranch}" "${lRepoUrl}" "${lInstallDir}"
else
  l_log "Repository already exists, updating"
  sudo -u "${lServiceUser}" git -C "${lInstallDir}" fetch origin "${lBranch}"
  sudo -u "${lServiceUser}" git -C "${lInstallDir}" checkout "${lBranch}"
  sudo -u "${lServiceUser}" git -C "${lInstallDir}" pull --ff-only
fi

l_log "Writing environment file"
cat >"${lInstallDir}/.env" <<EOF
SESSION_SECRET="${lSessionSecret}"
PORT=${lPort}
EOF
chown "${lServiceUser}:${lServiceUser}" "${lInstallDir}/.env"
chmod 600 "${lInstallDir}/.env"

l_log "Installing application dependencies"
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" ci

l_log "Preparing Prisma and SQLite"
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run prisma:generate
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run db:push

l_log "Building application"
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run build

l_log "Creating systemd service"
cat >/etc/systemd/system/ddns-plus.service <<EOF
[Unit]
Description=DDNS+
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${lServiceUser}
Group=${lServiceUser}
WorkingDirectory=${lInstallDir}
Environment=NODE_ENV=production
EnvironmentFile=${lInstallDir}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ddns-plus

l_log "Cleaning package cache"
apt-get autoremove -y
apt-get autoclean -y

l_log "${lApp} installation completed"
