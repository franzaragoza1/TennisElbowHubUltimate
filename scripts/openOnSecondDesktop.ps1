# Launches a script/executable and moves its window to the second virtual desktop
# (index 1) using the VirtualDesktop module (Install-Module VirtualDesktop). Meant to
# be invoked hidden from the Startup folder, so only the moved window ever becomes
# visible, and only on the secondary desktop, never the main one.
param(
    [Parameter(Mandatory = $true)][string]$ScriptPath
)

Import-Module VirtualDesktop

$proc = Start-Process -FilePath $ScriptPath -PassThru
$secondDesktop = Get-Desktop -Index 1

$deadline = (Get-Date).AddSeconds(15)
while ($proc.MainWindowHandle -eq 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 200
    $proc.Refresh()
}

if ($proc.MainWindowHandle -ne 0) {
    Move-Window -Hwnd $proc.MainWindowHandle -Desktop $secondDesktop | Out-Null
}
