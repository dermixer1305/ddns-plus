#!/usr/bin/env bash

# Copyright (c) 2026 DDNS+ contributors
# License: MIT | https://github.com/dermixer1305/ddns-plus/raw/master/LICENSE
# Source: https://github.com/dermixer1305/ddns-plus

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"

color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

lApp="DDNS+"
lInstallDir="/opt/ddns-plus"
lRepoUrl="${DDNS_PLUS_REPO:-https://github.com/dermixer1305/ddns-plus.git}"
lBranch="${DDNS_PLUS_BRANCH:-master}"
lPort="${DDNS_PLUS_PORT:-3000}"
lSessionSecret=""
lServiceUser="ddns-plus"

msg_info "Installing Dependencies"
$STD apt-get install -y git openssl sqlite3 sudo ca-certificates
msg_ok "Installed Dependencies"

lSessionSecret="$(openssl rand -hex 32)"

NODE_VERSION="24"
setup_nodejs

msg_info "Creating Service User"
if ! id "${lServiceUser}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${lServiceUser}"
fi
msg_ok "Created Service User"

msg_info "Installing ${lApp}"
mkdir -p "${lInstallDir}"
chown "${lServiceUser}:${lServiceUser}" "${lInstallDir}"
sudo -u "${lServiceUser}" git clone --branch "${lBranch}" "${lRepoUrl}" "${lInstallDir}"
cat >"${lInstallDir}/.env" <<EOF
SESSION_SECRET="${lSessionSecret}"
PORT=${lPort}
SESSION_COOKIE_SECURE="false"
EOF
chown "${lServiceUser}:${lServiceUser}" "${lInstallDir}/.env"
chmod 600 "${lInstallDir}/.env"
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" ci
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run prisma:generate
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run db:push
sudo -u "${lServiceUser}" npm --prefix "${lInstallDir}" run build
msg_ok "Installed ${lApp}"

msg_info "Creating Service"
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
systemctl enable -q --now ddns-plus
msg_ok "Created Service"

msg_info "Creating Update Command"
cat >/usr/local/bin/ddns-plus-update <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

lInstallDir="${lInstallDir}"
lServiceUser="${lServiceUser}"

function l_log() {
  echo "[DDNS+] \$*"
}

if [[ "\$(id -u)" -ne 0 ]]; then
  echo "[DDNS+] ERROR: Run this command as root inside the DDNS+ LXC container." >&2
  exit 1
fi

l_log "Stopping service"
systemctl stop ddns-plus || true

function l_restart_service() {
  systemctl start ddns-plus || true
}

trap l_restart_service EXIT

l_log "Pulling latest code"
sudo -u "\${lServiceUser}" git -C "\${lInstallDir}" pull --ff-only

l_log "Installing dependencies"
sudo -u "\${lServiceUser}" npm --prefix "\${lInstallDir}" ci

l_log "Updating Prisma client and database"
sudo -u "\${lServiceUser}" npm --prefix "\${lInstallDir}" run prisma:generate
sudo -u "\${lServiceUser}" npm --prefix "\${lInstallDir}" run db:push

l_log "Building application"
sudo -u "\${lServiceUser}" npm --prefix "\${lInstallDir}" run build

l_log "Restarting service"
systemctl restart ddns-plus
trap - EXIT

l_log "Update completed"
EOF
chmod 755 /usr/local/bin/ddns-plus-update
ln -sf /usr/local/bin/ddns-plus-update /usr/local/bin/update
msg_ok "Created Update Command"

motd_ssh
customize
cleanup_lxc
