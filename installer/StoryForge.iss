#define AppVersion "3.1.0"
#ifndef ReleaseRoot
  #define ReleaseRoot "..\release\StoryForge"
#endif
[Setup]
AppId={{B5F47D41-970F-48AA-AFE3-4982B853F742}
AppName=StoryForge US
AppVersion={#AppVersion}
AppPublisher=StoryForge US
DefaultDirName={sd}\Tools\StoryForge US
DisableDirPage=no
UsePreviousAppDir=yes
DefaultGroupName=StoryForge US
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=StoryForge-US-{#AppVersion}-Setup
SetupIconFile=storyforge.ico
UninstallDisplayIcon={app}\StoryForge Start.exe
WizardStyle=modern
Compression=lzma2/fast
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
VersionInfoVersion={#AppVersion}.0
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create StoryForge Start and StoryForge Stop Desktop shortcuts"; GroupDescription: "Shortcuts:"

[Files]
Source: "{#ReleaseRoot}\*"; DestDir: "{app}"; Excludes: "StoryForge.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#ReleaseRoot}\StoryForge.exe"; DestDir: "{app}"; DestName: "StoryForge Start.exe"; Flags: ignoreversion

[InstallDelete]
Type: files; Name: "{app}\StoryForge.exe"
Type: files; Name: "{app}\Stop StoryForge.lnk"
Type: files; Name: "{group}\Start StoryForge.lnk"
Type: files; Name: "{group}\Stop StoryForge.lnk"
Type: files; Name: "{autodesktop}\StoryForge US.lnk"
Type: files; Name: "{autodesktop}\Start StoryForge.lnk"
Type: files; Name: "{autodesktop}\Stop StoryForge.lnk"

[Dirs]
Name: "{code:DataDirectory}"
Name: "{code:DataDirectory}\logs"

[Icons]
Name: "{group}\StoryForge Start"; Filename: "{app}\StoryForge Start.exe"; WorkingDir: "{app}"
Name: "{group}\StoryForge Stop"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper stop"; WorkingDir: "{app}"
Name: "{group}\Install or Reload Browser Bridge"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper bridge"; WorkingDir: "{app}"
Name: "{group}\Open Logs"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper logs"; WorkingDir: "{app}"
Name: "{group}\Open Data Folder"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper data"; WorkingDir: "{app}"
Name: "{group}\User Guide"; Filename: "{app}\USER_GUIDE.md"
Name: "{group}\Uninstall StoryForge US"; Filename: "{uninstallexe}"
Name: "{autodesktop}\StoryForge Start"; Filename: "{app}\StoryForge Start.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autodesktop}\StoryForge Stop"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper stop"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{app}\StoryForge Stop"; Filename: "{app}\StoryForge Start.exe"; Parameters: "--helper stop"; WorkingDir: "{app}"

[Run]
Filename: "{app}\StoryForge Start.exe"; Description: "Open StoryForge Start"; Flags: nowait postinstall skipifsilent

[Code]
function DataDirectory(Param: String): String;
begin
  Result := ExtractFileDir(ExpandConstant('{app}')) + '\StoryForge US Data';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataPath: String;
begin
  if CurUninstallStep = usPostUninstall then begin
    DataPath := DataDirectory('');
    { Never remove a drive root, installation folder, or a folder without our DB marker. }
    if (not UninstallSilent) and (Length(DataPath) > 18) and (CompareText(DataPath, ExpandConstant('{app}')) <> 0)
       and FileExists(DataPath + '\storyforge.db') then begin
      if MsgBox('Your stories and media were preserved at:' + #13#10 + DataPath + #13#10#13#10 +
        'Also permanently delete this default data folder? Choose No to keep your work. Custom data folders are always preserved.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(DataPath, True, True, True);
    end;
  end;
end;
