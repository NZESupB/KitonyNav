import { useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { Globe2 } from "lucide-react";
import { fetchClientNetwork } from "../../api";
import { isPublicAddress, publicStunAddress } from "../../lib/network";
import { useVisitorGeo } from "../../hooks/use-visitor-geo";

export function NetworkPanel() {
  const [httpInfo, setHttpInfo] = useState<{ address?: string; family?: string; status: string }>({ status: "unavailable" });
  const [webrtcAddress, setWebrtcAddress] = useState("");
  const { data: geoInfo = {} } = useVisitorGeo();
  const [userAgent] = useState(() => navigator.userAgent);

  useEffect(() => {
    const controller = new AbortController();
    fetchClientNetwork(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setHttpInfo(value); })
      .catch(() => { if (!controller.signal.aborted) setHttpInfo({ status: "unavailable" }); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (typeof RTCPeerConnection === "undefined") return;
    let active = true;
    let peer: RTCPeerConnection | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = () => { active = false; clearTimeout(timer); peer?.close(); };
    try {
      const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peer = connection;
      connection.createDataChannel("kitony-network");
      connection.onicecandidate = (event) => {
        const address = event.candidate && publicStunAddress(event.candidate);
        if (active && address) setWebrtcAddress((current) => current || address);
      };
      connection.onicegatheringstatechange = () => { if (connection.iceGatheringState === "complete") close(); };
      connection.createOffer().then((offer) => { if (active) return connection.setLocalDescription(offer); }).catch(close);
      timer = setTimeout(close, 5000);
    } catch {
      close();
    }
    return close;
  }, []);

  const httpAddress = httpInfo.address && isPublicAddress(httpInfo.address) ? httpInfo.address : "";
  const ipAddress = geoInfo.ip || httpAddress || webrtcAddress || "无法确认";
  const location = geoInfo.location || "无法确认";
  const operator = [geoInfo.isp, geoInfo.asn].filter(Boolean).join(" · ") || "无法确认";
  const ipFamily = ipAddress.includes(":") ? "IPv6" : /^\d+(?:\.\d+){3}$/.test(ipAddress) ? "IPv4" : "未知";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="network-float" aria-label="网络出口信息">
          <span className="network-float-summary">
            <span className="network-float-mark"><Globe2 size={14} /></span>
            <span className="network-pill" title={location}>{location}</span>
            <span className="network-pill network-pill-ip" title={ipAddress}>{ipAddress}</span>
            <span className="network-float-source">{ipFamily}</span>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="network-popover" side="top" sideOffset={10} collisionPadding={12} aria-label="网络出口信息详情">
          <dl className="network-float-details">
            <div><dt>IP 地址</dt><dd>{ipAddress}</dd></div>
            <div><dt>位置</dt><dd>{location}</dd></div>
            <div><dt>运营商</dt><dd>{operator}</dd></div>
            <div><dt>UA</dt><dd title={userAgent}>{userAgent}</dd></div>
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
