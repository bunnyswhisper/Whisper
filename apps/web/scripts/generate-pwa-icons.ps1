$ErrorActionPreference = 'Stop'
$webRoot = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $webRoot 'public\icons'
$logoPath = Join-Path $webRoot 'public\logo.png'

if (-not (Test-Path $logoPath)) {
  throw "Source logo not found: $logoPath"
}

New-Item -ItemType Directory -Force -Path $dir | Out-Null
Add-Type -AssemblyName System.Drawing

$logo = [System.Drawing.Image]::FromFile($logoPath)
$logoAspect = $logo.Width / $logo.Height

function New-LogoBitmap {
  param(
    [int]$Size,
    [double]$LogoHeightRatio
  )

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 0))

  $targetH = [int][Math]::Round($Size * $LogoHeightRatio)
  $targetW = [int][Math]::Round($targetH * $logoAspect)

  $maxW = [int][Math]::Round($Size * $LogoHeightRatio)
  if ($targetW -gt $maxW) {
    $targetW = $maxW
    $targetH = [int][Math]::Round($targetW / $logoAspect)
  }

  $x = [int][Math]::Floor(($Size - $targetW) / 2.0)
  $y = [int][Math]::Floor(($Size - $targetH) / 2.0)

  $g.DrawImage($logo, $x, $y, $targetW, $targetH)
  $g.Dispose()
  return $bmp
}

function Write-LogoIcon {
  param(
    [int]$Size,
    [string]$OutPath,
    [double]$LogoHeightRatio
  )

  $bmp = New-LogoBitmap -Size $Size -LogoHeightRatio $LogoHeightRatio
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function New-CircularFaviconBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver

  $circleSize = [int][Math]::Round($Size * 0.9)
  $cx = [int][Math]::Floor(($Size - $circleSize) / 2.0)
  $cy = [int][Math]::Floor(($Size - $circleSize) / 2.0)
  $g.FillEllipse(
    [System.Drawing.Brushes]::Black,
    $cx,
    $cy,
    $circleSize,
    $circleSize
  )

  $targetH = [int][Math]::Round($circleSize * 0.55)
  $targetW = [int][Math]::Round($targetH * $logoAspect)
  $maxW = [int][Math]::Round($circleSize * 0.55)
  if ($targetW -gt $maxW) {
    $targetW = $maxW
    $targetH = [int][Math]::Round($targetW / $logoAspect)
  }

  $x = [int][Math]::Floor(($Size - $targetW) / 2.0)
  $y = [int][Math]::Floor(($Size - $targetH) / 2.0)
  $g.DrawImage($logo, $x, $y, $targetW, $targetH)
  $g.Dispose()
  return $bmp
}

function Write-CircularFaviconPng {
  param(
    [int]$Size,
    [string]$OutPath
  )

  $bmp = New-CircularFaviconBitmap -Size $Size
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Write-FaviconIco {
  param(
    [string]$OutPath,
    [int]$Size = 32
  )

  if (-not ([System.Management.Automation.PSTypeName]'NativeIcon').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeIcon {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@
  }

  $bmp = New-CircularFaviconBitmap -Size $Size
  $hIcon = $bmp.GetHicon()
  try {
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $fs = [System.IO.File]::Open($OutPath, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    $icon.Dispose()
  } finally {
    [NativeIcon]::DestroyIcon($hIcon) | Out-Null
    $bmp.Dispose()
  }
}

# Normal icons: logo ~65% of canvas height (within 60–70% target)
$normalRatio = 0.65
# Maskable: logo ~50% of canvas height (within 45–55% safe zone)
$maskableRatio = 0.50

# Browser tab favicon: circular black badge, transparent outside the circle
Write-CircularFaviconPng -Size 32 -OutPath (Join-Path $dir 'favicon-32.png')

# Square black PWA / touch icons (unchanged style)
Write-LogoIcon -Size 32 -OutPath (Join-Path $dir 'icon-32.png') -LogoHeightRatio $normalRatio
Write-LogoIcon -Size 180 -OutPath (Join-Path $dir 'apple-touch-icon.png') -LogoHeightRatio $normalRatio
Write-LogoIcon -Size 180 -OutPath (Join-Path $dir 'icon-180.png') -LogoHeightRatio $normalRatio
Copy-Item (Join-Path $dir 'apple-touch-icon.png') (Join-Path $webRoot 'public\apple-touch-icon.png') -Force
Write-LogoIcon -Size 192 -OutPath (Join-Path $dir 'icon-192.png') -LogoHeightRatio $normalRatio
Write-LogoIcon -Size 512 -OutPath (Join-Path $dir 'icon-512.png') -LogoHeightRatio $normalRatio
Write-LogoIcon -Size 512 -OutPath (Join-Path $dir 'icon-maskable-512.png') -LogoHeightRatio $maskableRatio

$appFavicon = Join-Path $webRoot 'app\favicon.ico'
$publicFavicon = Join-Path $webRoot 'public\favicon.ico'
Write-FaviconIco -OutPath $appFavicon -Size 32
Write-FaviconIco -OutPath $publicFavicon -Size 32

$logo.Dispose()
Write-Host "Wrote PWA icons from $logoPath to $dir"
Write-Host "Wrote circular favicon.ico + favicon-32.png"
