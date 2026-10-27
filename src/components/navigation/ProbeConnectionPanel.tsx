import { useState } from "react";
import { Dialog } from "radix-ui";
import { Copy, Plug, X } from "lucide-react";
import type { DeviceProbe } from "../../hooks/use-connectivity";
import { defaultProbeUrl, probeStartCommand } from "../../lib/probe";

const stateLabels = { idle: "未连接", connecting: "连接中", connected: "已连接", error: "连接异常" };

export function ProbeConnectionPanel({ probe }: { probe: DeviceProbe }) {
  return <Dialog.Root>
    <Dialog.Trigger asChild><button className="quiet-button" aria-label="本机探针设置"><Plug size={16} /> 本机探针<span className={`probe-indicator ${probe.connection.state}`} aria-hidden="true" /></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="probe-overlay" />
      <Dialog.Content className="probe-dialog">
        <div className="probe-heading"><Dialog.Title>本机探针</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="关闭本机探针设置"><X size={18} /></button></Dialog.Close></div>
        <Dialog.Description>在访问此网页的设备运行探针，即可查看真实 TCP 延迟。地址仅保存于当前设备的当前站点。</Dialog.Description>
        <ProbeSettings probe={probe} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ProbeSettings({ probe }: { probe: DeviceProbe }) {
  const { connection, requiredTargets, missingTargets } = probe;
  const [draft, setDraft] = useState(connection.address);
  const [copyMessage, setCopyMessage] = useState("");
  const origin = window.location.origin;
  const connecting = connection.state === "connecting";
  let command = "";
  let commandError = "";
  try { command = probeStartCommand(requiredTargets, origin, draft); }
  catch { commandError = "地址无效，请修正或恢复默认地址后生成启动命令。"; }
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopyMessage("已复制启动命令"); }
    catch { setCopyMessage("无法访问剪贴板，请选择下方文本手动复制。"); }
  };
  return <div className="probe-settings">
    <dl className="probe-facts">
      <div><dt>网页来源</dt><dd>{origin}</dd></div>
      <div><dt>实际地址</dt><dd>{connection.address || "未填写"}</dd></div>
      <div><dt>连接状态</dt><dd role="status">{stateLabels[connection.state]}</dd></div>
      <div><dt>最后成功</dt><dd>{connection.lastConnectedAt ? new Date(connection.lastConnectedAt).toLocaleString("zh-CN") : "尚未连接"}</dd></div>
    </dl>
    <form onSubmit={(event) => { event.preventDefault(); probe.connect(draft); }}>
      <label className="probe-address">探针地址<input value={draft} onChange={(event) => { setDraft(event.target.value); setCopyMessage(""); }} placeholder={defaultProbeUrl} autoComplete="off" spellCheck={false} /></label>
      <div className="probe-actions">
        <button className="primary-button" type="submit" disabled={connecting && draft.trim() === connection.address}>{connecting ? "连接中…" : "保存并连接 / 重试"}</button>
        <button className="quiet-button" type="button" onClick={() => { setDraft(defaultProbeUrl); setCopyMessage(""); probe.reset(); }} disabled={connecting && connection.address === defaultProbeUrl}>恢复默认</button>
      </div>
    </form>
    {connecting && <p role="status">正在连接。手动连接最多等待 30 秒，请处理浏览器的本地网络访问提示。</p>}
    {connection.error && <p className="probe-error" role="alert">{connection.error}</p>}
    {probe.storageWarning && <p role="status">{probe.storageWarning}</p>}
    <details open={missingTargets != null && missingTargets.length > 0}>
      <summary>所需目标 {requiredTargets.length} 个{missingTargets ? ` · 未获允许 ${missingTargets.length} 个` : " · 白名单尚未读取"}</summary>
      {missingTargets && missingTargets.length > 0 && <div className="probe-error"><p>这些目标尚未加入探针白名单：</p><pre>{missingTargets.join("\n")}</pre></div>}
      <p>完整目标清单（host:port）：</p><pre>{requiredTargets.join("\n") || "当前没有启用检测的目标"}</pre>
    </details>
    <section className="probe-instructions" aria-label="启动与排查">
      <h3>在此设备启动</h3>
      <p>已安装 Go 并取得项目源码后，在项目根目录运行下方命令。核对目标清单后执行；网站 Docker 容器不会为访问者启动本机探针。</p>
      {commandError ? <p className="probe-error">{commandError}</p> : <>
        <pre className="probe-command" tabIndex={0}>{command}</pre>
        {command.startsWith("go ") && <button className="quiet-button" type="button" onClick={() => void copy()}><Copy size={15} /> 复制启动命令</button>}
      </>}
      {copyMessage && <p role="status">{copyMessage}</p>}
      <p>命令使用 POSIX shell 引号，适用于 macOS / Linux / Windows Git Bash。进程退出或设备重启后需要重新启动；网页和探针需使用兼容版本。</p>
      <h3>无法连接时</h3>
      <ol>
        <li>确认探针正在此设备运行，监听地址与上方一致。</li>
        <li>确认启动参数 --origins 包含当前网页来源，--allow 包含所需目标。</li>
        <li>打开浏览器地址栏的站点权限，允许“本地网络访问”，然后点击重试。浏览器或系统可能各有权限提示。</li>
        <li>检查代理是否绕过回环地址。TCP 使用设备路由，可能与浏览器代理路径不同；无法连接并不等于目标网站宕机。</li>
      </ol>
    </section>
  </div>;
}
