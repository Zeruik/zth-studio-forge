'use strict';
function installer(config){return String.raw`#define AppName "${config.name}"
#define AppExe "${config.exe}"
#define AppVersion "${config.version}"
[Setup]
AppId={{${config.appId}}
AppName={#AppName}
AppVersion={#AppVersion}
VersionInfoVersion=${config.version}.0
AppPublisher=理工阿白菌 / TechABJ
AppPublisherURL=mailto:zeruik@qq.com
DefaultDirName={code:DefaultInstallFolder}
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=.
OutputBaseFilename=Install-${config.folder}-v${config.version}
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
ShowLanguageDialog=no
UsePreviousLanguage=yes
UsePreviousAppDir=yes
LicenseFile=LICENSE
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
CloseApplications=no
RestartApplications=no
[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
[Messages]
chinesesimp.WelcomeLabel1=欢迎使用 {#AppName}
chinesesimp.WelcomeLabel2=本安装包已包含 Electron 桌面运行环境，安装和运行助手无需另外安装 Node.js、Python 或浏览器。%n%n安装器不会修改系统 PATH，也不会启动 WSL 或开发环境安装任务。应用内需要联网下载的功能会另行说明和确认。%n%n请使用英文安装路径。个人数据保存在独立的 Windows AppData 目录，卸载默认保留。
english.WelcomeLabel1=Welcome to {#AppName}
english.WelcomeLabel2=The Electron desktop runtime is included. No separate Node.js, Python or browser is needed.%n%nSetup does not edit PATH or run WSL/development-environment tasks. Optional application downloads and actions are reviewed separately.%n%nUse an English installation path. Personal data is stored in a separate Windows AppData directory and retained on uninstall.
[CustomMessages]
chinesesimp.StartMenu=创建开始菜单快捷方式
english.StartMenu=Create a Start menu shortcut
chinesesimp.Launch=打开 {#AppName}
english.Launch=Open {#AppName}
[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"
Name: "startmenu"; Description: "{cm:StartMenu}"
[Files]
Source: "payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; AppUserModelID: "${config.id}"; Tasks: desktopicon
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; AppUserModelID: "${config.id}"; Tasks: startmenu
[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:Launch}"; Flags: postinstall nowait skipifsilent
[Code]
const UninstallKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{${config.appId}}_is1';
function Tr(const ZH, EN: String): String;
begin if ActiveLanguage = 'english' then Result := EN else Result := ZH; end;
function EnglishPath(const Value: String): Boolean;
var I: Integer;
begin
 Result := (Length(Value) > 3) and (Value[2] = ':') and (Value[3] = '\');
 if not Result then Exit;
 for I := 1 to Length(Value) do if (Ord(Value[I]) < 32) or (Ord(Value[I]) > 126) then Result := False;
 if Pos('..',Value) > 0 then Result := False;
end;
function DefaultInstallFolder(Param: String): String;
begin
 Result := ExpandConstant('{localappdata}\Programs\') + '${config.folder}';
 if not EnglishPath(Result) then Result := ExpandConstant('{sd}\') + '${config.folder}';
end;
function Newer(const Version: String): Boolean;
var Existing,Current: Int64;
begin
 Result := StrToVersion(Version,Existing) and StrToVersion('{#AppVersion}',Current);
 if Result then Result := ComparePackedVersion(Existing,Current) > 0;
end;
function RegisteredNewer: Boolean;
var Version: String;
begin
 Result := (RegQueryStringValue(HKCU64,UninstallKey,'DisplayVersion',Version) and Newer(Version)) or
 (RegQueryStringValue(HKCU32,UninstallKey,'DisplayVersion',Version) and Newer(Version)) or
 (RegQueryStringValue(HKLM64,UninstallKey,'DisplayVersion',Version) and Newer(Version)) or
 (RegQueryStringValue(HKLM32,UninstallKey,'DisplayVersion',Version) and Newer(Version));
end;
function RunningError: String;
var Locator,Services,Processes: Variant;
begin
 Result := '';
 try
  Locator := CreateOleObject('WbemScripting.SWbemLocator');
  Services := Locator.ConnectServer('.', 'root\CIMV2');
  Processes := Services.ExecQuery('SELECT ProcessId FROM Win32_Process WHERE Name="{#AppExe}"');
  if Processes.Count > 0 then Result := Tr('请先保存并正常退出应用，再重试。安装器不会强制关闭应用。','Save and exit the application, then retry. Setup will not force it to close.');
 except
  Result := Tr('无法检查应用运行状态；尚未覆盖文件，请检查 Windows 管理服务。','Cannot check application state. Files were not overwritten; check Windows management services.');
 end;
 if Result <> '' then Log('APP_RUNNING_OR_CHECK_UNAVAILABLE');
end;
function InitializeSetup: Boolean;
begin
 Result := not RegisteredNewer;
 if not Result then begin Log('DOWNGRADE_BLOCKED');if not WizardSilent then MsgBox(Tr('已安装更新版本，禁止降级覆盖。','A newer version is installed. Downgrade is blocked.'),mbError,MB_OK);end;
end;
procedure InitializeWizard;
var Notice:TNewStaticText;
begin
 Notice := TNewStaticText.Create(WizardForm);Notice.Parent := WizardForm.SelectDirPage;
 Notice.SetBounds(ScaleX(0),ScaleY(148),WizardForm.SelectDirPage.Width,ScaleY(60));
 Notice.WordWrap := True;Notice.AutoSize := False;
 Notice.Caption := Tr('请使用英文绝对路径（允许空格）。'+#13#10+'个人资料保存在 AppData，卸载时保留。'+#13#10+'安装器不修改 PATH，也不注册全局 Python。','Use an English absolute path; spaces are allowed.'+#13#10+'Personal data is kept in AppData after uninstall.'+#13#10+'Setup does not modify PATH or register global Python.');
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var Version:String;
begin
 Result := '';
 if not EnglishPath(ExpandConstant('{app}')) then begin Result := Tr('安装路径必须为英文绝对路径。','Choose an English absolute installation path.');Log('ENGLISH_PATH_REQUIRED');Exit;end;
 if RegisteredNewer or (GetVersionNumbersString(ExpandConstant('{app}\{#AppExe}'),Version) and Newer(Version)) then begin Result := 'DOWNGRADE_BLOCKED';Exit;end;
 Result := RunningError;
end;
function InitializeUninstall: Boolean;
var Error:String;
begin
 Error := RunningError;Result := Error = '';
 if (not Result) and (not UninstallSilent) then MsgBox(Error,mbError,MB_OK);
end;
`;}
module.exports={installer};
