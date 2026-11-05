/** A multicast ping on one interface, and the addresses that interface already holds. */
export type PeerReplies = {
  /** Output of `ping6 -I <device> ff02::1`. */
  pingOutput: string;
  /** BSD device the ping went out on, such as bridge0. */
  device: string;
  /** This Mac's IPv6 addresses on `device`, lowercase and without a zone. */
  own: string[];
};
