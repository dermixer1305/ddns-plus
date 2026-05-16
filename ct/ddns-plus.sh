#!/usr/bin/env bash
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)

# Copyright (c) 2026 DDNS+ contributors
# License: MIT | https://github.com/dermixer1305/ddns-plus/raw/master/LICENSE
# Source: https://github.com/dermixer1305/ddns-plus

APP="DDNS+"
var_hostname="${var_hostname:-ddns-plus}"
var_tags="${var_tags:-dns;ddns}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-2048}"
var_disk="${var_disk:-8}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
var_install="ddns-plus-install"
color
catch_errors

DDNS_PLUS_BRANCH="${DDNS_PLUS_BRANCH:-master}"
DDNS_PLUS_RAW_BASE="${DDNS_PLUS_RAW_BASE:-https://raw.githubusercontent.com/dermixer1305/ddns-plus/${DDNS_PLUS_BRANCH}}"
DDNS_PLUS_INSTALL_SCRIPT_URL="${DDNS_PLUS_RAW_BASE}/install/ddns-plus-install.sh"

eval "$(declare -f build_container | sed '1s/build_container/ddns_plus_community_build_container/')"

function curl() {
  case "${*: -1}" in
    *"/install/${var_install}.sh")
      command curl -fsSL "$DDNS_PLUS_INSTALL_SCRIPT_URL"
      ;;
    *)
      command curl "$@"
      ;;
  esac
}

function build_container() {
  export DDNS_PLUS_REPO="${DDNS_PLUS_REPO:-https://github.com/dermixer1305/ddns-plus.git}"
  export DDNS_PLUS_BRANCH
  ddns_plus_community_build_container
}

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -d /opt/ddns-plus ]]; then
    msg_error "No ${APP} installation found!"
    exit
  fi

  if [[ ! -x /usr/local/bin/ddns-plus-update ]]; then
    msg_error "No DDNS+ update command found!"
    exit
  fi

  /usr/local/bin/ddns-plus-update
  msg_ok "Updated successfully!"
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW} Access it using the following URL:${CL}"
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:${DDNS_PLUS_PORT:-3000}${CL}"
