// Exact owner-authorized local-password copy delta; every other frozen string stays unchanged.
export const approvedLoginChanges: Record<string, Record<string, string>> = {
  en_us: { 'login.register_subtitle': 'Create an account stored on this device', 'login.passwordless_login': 'A local password is required to open this account', 'login.error.password_too_short': 'Use at least 12 Unicode code points' },
  zh_cn: { 'login.register_subtitle': '创建仅保存在此设备上的账号', 'login.passwordless_login': '打开此账号需要本地密码', 'login.error.password_too_short': '密码至少需要12个 Unicode 码点' },
  zh_tw: { 'login.register_subtitle': '建立僅儲存在此裝置上的帳號', 'login.passwordless_login': '開啟此帳號需要本機密碼', 'login.error.password_too_short': '密碼至少需要12個 Unicode 碼點' },
};
