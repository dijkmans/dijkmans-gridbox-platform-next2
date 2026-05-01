path = "src/listener.py"
with open(path, "rb") as f:
    raw = f.read()

crlf = b"\r\n" in raw
src = raw.decode("utf-8", errors="replace")

def fix(s):
    return s.replace("\n", "\r\n") if crlf else s

# ── Wijziging 1: software_update dict opruimen ─────────────────────────────
old_sw = fix('''        software_update = {
            "latestGithub": latest_github,
            "versionRaspberry": version_raspberry,
            "targetVersion": target_version,
            "deploymentMode": deployment_mode,
            "deploymentStatus": deployment_status,
            "softwareUpdateRequested": software_update_requested,
            "updateStatus": update_status,
            "githubTagPattern": sw_cfg.get("githubTagPattern", get_github_tag_pattern()),
            "serviceName": sw_cfg.get("serviceName", "gridbox.service"),
            "pipInstallOnDeploy": sw_cfg.get("pipInstallOnDeploy", True),
            "restartDelaySeconds": sw_cfg.get("restartDelaySeconds", 2),
            "gitCommitLocal": get_running_commit(),
            "lastHeartbeatIso": nu.isoformat(),
            "lastHeartbeatUnix": int(nu.timestamp()),
            "piModel": read_pi_model(),
            "platform": platform.platform(),
            "pythonVersion": platform.python_version(),
            "lastError": last_error
        }''')

new_sw = fix('''        software_update = {
            "versionRaspberry": version_raspberry,
            "targetVersion": target_version,
            "deploymentStatus": deployment_status,
            "softwareUpdateRequested": software_update_requested,
            "updateStatus": update_status,
            "gitCommitLocal": get_running_commit(),
            "lastHeartbeatIso": nu.isoformat(),
            "lastHeartbeatUnix": int(nu.timestamp()),
            "lastError": last_error
        }

        runtime_update = {
            "piModel": read_pi_model(),
            "platform": platform.platform(),
            "pythonVersion": platform.python_version(),
            "serviceName": sw_cfg.get("serviceName", "gridbox.service"),
        }''')

if old_sw in src:
    src = src.replace(old_sw, new_sw, 1)
    print("OK software_update dict opgeruimd + runtime_update aangemaakt")
else:
    print("MISS software_update dict niet gevonden")

# ── Pas ook het Firestore set-blok aan om runtime_update mee te schrijven ──
old_fs_set = fix('''        box_doc_ref.set({
            "software": software_update,
            "status": "online",
            "updatedAt": nu.isoformat(),
            "updatedBy": f"gridbox-service-{VERSION}"
        }, merge=True)''')

new_fs_set = fix('''        box_doc_ref.set({
            "software": software_update,
            "runtime": runtime_update,
            "status": "online",
            "updatedAt": nu.isoformat(),
            "updatedBy": f"gridbox-service-{VERSION}"
        }, merge=True)''')

if old_fs_set in src:
    src = src.replace(old_fs_set, new_fs_set, 1)
    print("OK Firestore set-blok bijgewerkt met runtime_update")
else:
    print("MISS Firestore set-blok niet gevonden")

# ── Log-regel aanpassen (latestGithub eruit) ───────────────────────────────
old_log = fix(
    '            f"versionRaspberry={version_raspberry} | targetVersion={target_version} | "\n'
    '            f"deploymentStatus={deployment_status} | updateStatus={update_status}"\n'
)
new_log = fix(
    '            f"versionRaspberry={version_raspberry} | targetVersion={target_version} | "\n'
    '            f"deploymentStatus={deployment_status} | updateStatus={update_status}"\n'
)
# Log hoeft niet te veranderen — latestGithub zit al niet meer in de nieuwe dict

# ── Wijziging 2: lastRequestedTargetVersion en lastPreparedTargetVersion ───
old_applying = fix('''        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "APPLYING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastRequestedTargetVersion": target_version,
            "lastUpdateAttemptAt": now_iso()
        })''')

new_applying = fix('''        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "APPLYING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastUpdateAttemptAt": now_iso()
        })''')

if old_applying in src:
    src = src.replace(old_applying, new_applying, 1)
    print("OK lastRequestedTargetVersion verwijderd uit APPLYING write")
else:
    print("MISS APPLYING write_software_fields niet gevonden")

old_restarting = fix('''        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "RESTARTING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastPreparedTargetVersion": target_version,
            "lastRestartRequestedAt": now_iso()
        })''')

new_restarting = fix('''        write_software_fields({
            "softwareUpdateRequested": False,
            "updateStatus": "RESTARTING",
            "deploymentStatus": "MISMATCH",
            "lastError": None,
            "lastRestartRequestedAt": now_iso()
        })''')

if old_restarting in src:
    src = src.replace(old_restarting, new_restarting, 1)
    print("OK lastPreparedTargetVersion verwijderd uit RESTARTING write")
else:
    print("MISS RESTARTING write_software_fields niet gevonden")

# ── Log-regel aanpassen: latestGithub eruit ───────────────────────────────
old_log_line = fix(
    '        log(\n'
    '            f"ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯ÃÂ¸ÃÂ Heartbeat OK | latestGithub={latest_github} | "\n'
    '            f"versionRaspberry={version_raspberry} | targetVersion={target_version} | "\n'
    '            f"deploymentStatus={deployment_status} | updateStatus={update_status}"\n'
    '        )\n'
)
new_log_line = fix(
    '        log(\n'
    '            f"Heartbeat OK | versionRaspberry={version_raspberry} | targetVersion={target_version} | "\n'
    '            f"deploymentStatus={deployment_status} | updateStatus={update_status}"\n'
    '        )\n'
)
if old_log_line in src:
    src = src.replace(old_log_line, new_log_line, 1)
    print("OK heartbeat log-regel bijgewerkt (latestGithub eruit)")
else:
    print("WARN: log-regel niet gevonden via bytes — mogelijk geen effect, niet kritisch")

with open(path, "wb") as f:
    f.write(src.encode("utf-8"))

print("listener.py geschreven")
