import * as els from './elements';

import { Toast } from 'bootstrap';

export const pos = new Toast(els.posToast, { autohide: false });

export const posPermissionDenied = new Toast(els.posPermissionDeniedToast, { autohide: false });
export const posUnavailable = new Toast(els.posUnavailableToast, { autohide: false });
export const posTimeout = new Toast(els.posTimeoutToast, { autohide: false });
export const vicDownloadingSites = new Toast(els.vicDownloadingSitesToast, { autohide: false });
export const nswDownloadingSites = new Toast(els.nswDownloadingSitesToast, { autohide: false });
