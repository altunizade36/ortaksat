from pathlib import Path
import json, re, subprocess, time, xml.etree.ElementTree as ET
out=Path('audit/mobile-v2')
def adb(*args): return subprocess.check_output(['adb','-s','emulator-5556',*args])
def tree():
    try: adb('shell','uiautomator','dump','/sdcard/ortaksat-access.xml')
    except subprocess.CalledProcessError:
        time.sleep(2)
        adb('shell','uiautomator','dump','--compressed','/sdcard/ortaksat-access.xml')
    return ET.fromstring(adb('shell','cat','/sdcard/ortaksat-access.xml'))
def find(label):
    for n in tree().iter('node'):
        if n.get('content-desc')==label or n.get('text')==label: return n
    raise RuntimeError('Missing UI: '+label)
def tap(label):
    n=find(label);x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(1)
def shot(name):
    adb('shell','screencap','-p','/sdcard/access.png');adb('pull','/sdcard/access.png',str(out/name))
for attempt in range(12):
    labels={n.get('content-desc') for n in tree().iter('node')}
    if 'Google ile devam et' in labels: break
    if 'Profilim' in labels:
        tap('Profilim');continue
    time.sleep(3)
else: raise RuntimeError('Waited for the current mobile bundle, but auth/home did not become ready')
assert find('Google ile devam et').get('enabled')=='true'
tap('Google ile devam et')
find('Devam etmek için önce bu kutuyu işaretle.')
tap('Yasal metinleri kabul ediyorum')
assert find('Google ile devam et').get('enabled')=='true'
tap('Yasal metinleri kabul ediyorum')
tap('Google ile devam et')
find('Devam etmek için önce bu kutuyu işaretle.')
shot('android-auth-consent.png')
adb('shell','input','swipe','540','450','540','1900','500');time.sleep(1)
tap('Geç');time.sleep(2)
labels={n.get('content-desc') for n in tree().iter('node')}
assert {'OrtakSat kedi maskotu','Emlak','Vasıta','Elektronik','Tüm Kategoriler'} <= labels, labels
shot('android-home-cat.png')
tap('İlan Ver')
find('Geç')
shot('android-guest-create-blocked.png')
(out/'android-access-test.json').write_text(json.dumps({'nativeAndroid':True,'consentGate':True,'guestBrowse':True,'existingCatAsset':True,'categoryShortcutsVerified':5,'guestCreateBlocked':True},indent=2),encoding='utf-8')
print('Android native startup, consent, guest browse, cat asset and create guard passed.')
