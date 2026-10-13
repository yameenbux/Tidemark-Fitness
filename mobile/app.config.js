// app.json holds the config. This adjusts it per build:
// - the web base path when a build asks for it (the GitHub Pages deploy serves the app from a sub-path);
// - export compliance: the build makes no encryption claim in its Info.plist. Password-protected backups use
//   XChaCha20-Poly1305 and scrypt from @noble, standard algorithms that aren't Apple's. Declaring that up front
//   (ITSAppUsesNonExemptEncryption = YES) makes App Store Connect reject the upload (ITMS-90592) unless the build also
//   carries the code from approved encryption documentation (ITSEncryptionExportComplianceCode). Leaving the key out
//   lets the upload through; App Store Connect then asks the encryption questions for each build in TestFlight.
//   Once those answers give a result (or documentation is approved), set the key here. See COMPLIANCE.md.
module.exports = ({ config }) => {
  const { usesNonExemptEncryption, ...iosConfig } = config.ios?.config ?? {};
  const ios = { ...config.ios, config: iosConfig };
  const out = { ...config, ios };
  return process.env.WEB_BASE_URL ? { ...out, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } } : out;
};
