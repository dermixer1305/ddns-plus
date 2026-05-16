#!/usr/bin/env bash
set -Eeuo pipefail

lApp="DDNS+"
lRepoUrl="${DDNS_PLUS_REPO:-https://github.com/dermixer1305/ddns-plus.git}"
lBranch="${DDNS_PLUS_BRANCH:-main}"
lRawBase="${DDNS_PLUS_RAW_BASE:-https://raw.githubusercontent.com/dermixer1305/ddns-plus/${lBranch}}"
lInstallScriptUrl="${lRawBase}/scripts/proxmox-install-ddns-plus.sh"

function l_log() {
  echo "[DDNS+] $*"
}

function l_fail() {
  echo "[DDNS+] ERROR: $*" >&2
  exit 1
}

function l_prompt() {
  local pMessage="$1"
  local pDefault="$2"
  local lValue

  read -r -p "${pMessage} [${pDefault}]: " lValue
  echo "${lValue:-${pDefault}}"
}

function l_yes_no() {
  local pMessage="$1"
  local pDefault="$2"
  local lValue

  read -r -p "${pMessage} [${pDefault}]: " lValue
  lValue="${lValue:-${pDefault}}"
  [[ "${lValue}" =~ ^[YyJj] ]]
}

function l_next_vmid() {
  if command -v pvesh >/dev/null 2>&1; then
    pvesh get /cluster/nextid
    return
  fi

  echo "100"
}

function l_first_storage() {
  local pContent="$1"
  local lStorage

  lStorage="$(pvesm status -content "${pContent}" 2>/dev/null | awk 'NR>1 {print $1; exit}')"
  echo "${lStorage:-local}"
}

function l_latest_debian_template() {
  local lTemplate

  pveam update >/dev/null
  lTemplate="$(
    pveam available --section system |
      awk '/debian-13-standard/ {print $2}' |
      sort -V |
      tail -n 1
  )"

  if [[ -n "${lTemplate}" ]]; then
    echo "${lTemplate}"
    return
  fi

  pveam available --section system |
    awk '/debian-12-standard/ {print $2}' |
    sort -V |
    tail -n 1
}

function l_wait_for_container_ip() {
  local pVmid="$1"
  local lAttempt
  local lIp

  for lAttempt in {1..60}; do
    lIp="$(
      pct exec "${pVmid}" -- hostname -I 2>/dev/null |
        tr ' ' '\n' |
        grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' |
        head -n 1 || true
    )"

    if [[ -n "${lIp}" ]]; then
      echo "${lIp}"
      return
    fi

    sleep 2
  done

  echo ""
}

if [[ "$(id -u)" -ne 0 ]]; then
  l_fail "Run this script as root in the Proxmox VE shell."
fi

for lCommand in pct pveam pvesm; do
  if ! command -v "${lCommand}" >/dev/null 2>&1; then
    l_fail "Required Proxmox command not found: ${lCommand}"
  fi
done

lDefaultVmid="$(l_next_vmid)"
lDefaultTemplateStorage="$(l_first_storage vztmpl)"
lDefaultRootStorage="$(l_first_storage rootdir)"

echo
echo "DDNS+ Proxmox LXC installer"
echo

lVmid="$(l_prompt "Container ID" "${lDefaultVmid}")"
lHostname="$(l_prompt "Hostname" "ddns-plus")"
lCores="$(l_prompt "CPU cores" "2")"
lMemory="$(l_prompt "Memory in MB" "2048")"
lDisk="$(l_prompt "Disk size in GB" "8")"
lBridge="$(l_prompt "Network bridge" "vmbr0")"
lPort="$(l_prompt "DDNS+ port" "3000")"
lRootStorage="$(l_prompt "Root storage" "${lDefaultRootStorage}")"
lTemplateStorage="$(l_prompt "Template storage" "${lDefaultTemplateStorage}")"

if l_yes_no "Generate a random SESSION_SECRET" "Y"; then
  lSessionSecret="$(openssl rand -hex 32)"
else
  read -r -s -p "SESSION_SECRET: " lSessionSecret
  echo
  if [[ -z "${lSessionSecret}" ]]; then
    l_fail "SESSION_SECRET cannot be empty."
  fi
fi

if pct status "${lVmid}" >/dev/null 2>&1; then
  l_fail "Container ${lVmid} already exists."
fi

lTemplate="$(l_latest_debian_template)"
if [[ -z "${lTemplate}" ]]; then
  l_fail "Could not find a Debian 13 or Debian 12 LXC template."
fi

lTemplatePath="${lTemplateStorage}:vztmpl/${lTemplate}"

l_log "Downloading LXC template ${lTemplate}"
if ! pveam list "${lTemplateStorage}" | awk '{print $1}' | grep -qx "${lTemplatePath}"; then
  pveam download "${lTemplateStorage}" "${lTemplate}"
else
  l_log "Template already exists on ${lTemplateStorage}"
fi

l_log "Creating LXC container ${lVmid}"
pct create "${lVmid}" "${lTemplatePath}" \
  --hostname "${lHostname}" \
  --cores "${lCores}" \
  --memory "${lMemory}" \
  --rootfs "${lRootStorage}:${lDisk}" \
  --net0 "name=eth0,bridge=${lBridge},ip=dhcp" \
  --features nesting=1 \
  --unprivileged 1 \
  --onboot 1 \
  --ostype debian \
  --start 0

l_log "Starting LXC container"
pct start "${lVmid}"

l_log "Waiting for network"
lIp="$(l_wait_for_container_ip "${lVmid}")"
if [[ -z "${lIp}" ]]; then
  l_log "Container IP was not detected yet. Continuing installation anyway."
fi

l_log "Running DDNS+ installer inside the container"
pct exec "${lVmid}" -- bash -c \
  "curl -fsSL '${lInstallScriptUrl}' | DDNS_PLUS_REPO='${lRepoUrl}' DDNS_PLUS_BRANCH='${lBranch}' DDNS_PLUS_PORT='${lPort}' DDNS_PLUS_SESSION_SECRET='${lSessionSecret}' bash"

lIp="$(l_wait_for_container_ip "${lVmid}")"

echo
l_log "Completed successfully"
echo "Container ID: ${lVmid}"
if [[ -n "${lIp}" ]]; then
  echo "URL: http://${lIp}:${lPort}"
else
  echo "URL: http://<container-ip>:${lPort}"
fi
echo
echo "Useful commands:"
echo "  pct enter ${lVmid}"
echo "  pct exec ${lVmid} -- systemctl status ddns-plus"
echo "  pct exec ${lVmid} -- journalctl -u ddns-plus -f"
