# Write resumable page header evidence next to the staged inventory, never to the site.
param([Parameter(Mandatory=$true)][string]$Directory, [int]$Shard=0, [int]$Shards=1, [switch]$AllPages)
$ErrorActionPreference='Stop'
$rows=Get-Content -Raw -Encoding UTF8 (Join-Path $Directory inventory.json) | ConvertFrom-Json
$out=Join-Path $Directory headers
New-Item -ItemType Directory -Force $out | Out-Null
for($i=$Shard;$i -lt $rows.Count;$i+=$Shards) {
  $row=$rows[$i]
  if(!$row.sha256){continue}
  $pdf=Join-Path $Directory ($row.id+'.pdf')
  $pages=1
  for($page=1;$page -le $pages;$page++){
    $header=Join-Path $out ($row.id+'-'+$page+'.txt')
    try {
      if(!(Test-Path $header)){
        $lines=@(& "$PSScriptRoot/read-pdf-header.ps1" $pdf $page)
        $lines | Select-Object -First 40 | Set-Content -Encoding UTF8 ($header+'.tmp')
        Move-Item ($header+'.tmp') $header -Force
      }
      if($AllPages -and $page -eq 1 -and (Get-Content -TotalCount 1 $header) -match ' of (\d+)'){$pages=[int]$Matches[1]}
    } catch {Write-Warning "$($row.id) page ${page}: $_"}
  }
}
