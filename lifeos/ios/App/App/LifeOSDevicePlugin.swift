import Foundation
import UIKit
import Capacitor
import SQLite3
import Security
import CoreLocation
import UserNotifications

class LifeOSViewController: CAPBridgeViewController {
 override func capacitorDidLoad() { bridge?.registerPluginInstance(LifeOSDevicePlugin()) }
}

@objc(LifeOSDevicePlugin)
public class LifeOSDevicePlugin: CAPPlugin, CAPBridgedPlugin {
 public let identifier = "LifeOSDevicePlugin"
 public let jsName = "LifeOSDevice"
 public let pluginMethods: [CAPPluginMethod] = [
  CAPPluginMethod(name:"readWorkspace",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"writeWorkspace",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"secretGet",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"secretSet",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"secretRemove",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"exportFile",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"listPlaces",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"setPlaces",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"currentLocation",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"enablePlaces",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"disablePlaces",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"placeStatus",returnType:CAPPluginReturnPromise),
  CAPPluginMethod(name:"takeArrival",returnType:CAPPluginReturnPromise)
 ]
 private let queue = DispatchQueue(label:"com.munib.lifeos.sqlite")
 private var database: OpaquePointer?
 private let service = "com.munib.lifeos.auth"
 private var arrivalObserver: NSObjectProtocol?
 private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
 public override func load() {
  arrivalObserver=NotificationCenter.default.addObserver(forName:Notification.Name("LifeOSArrival"),object:nil,queue:.main){[weak self] _ in self?.notifyListeners("arrivalReceived",data:[:])}
  // Keychain survives uninstall. A fresh app installation must not inherit an identity.
  if !UserDefaults.standard.bool(forKey:"lifeos-keychain-initialized") {
   SecItemDelete([kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service] as CFDictionary)
   UserDefaults.standard.set(true,forKey:"lifeos-keychain-initialized")
  }
 }
 private func fail(_ message:String) -> NSError { NSError(domain:"LifeOS",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
 private func open() throws -> OpaquePointer {
  if let database { return database }
  var directory = try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true)
  directory.appendPathComponent("LifeOS",isDirectory:true)
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  var resource = URLResourceValues(); resource.isExcludedFromBackup = true
  try directory.setResourceValues(resource)
  let file = directory.appendingPathComponent("lifeos.sqlite")
  var pointer: OpaquePointer?
  guard sqlite3_open_v2(file.path,&pointer,SQLITE_OPEN_CREATE|SQLITE_OPEN_READWRITE|SQLITE_OPEN_FULLMUTEX,nil)==SQLITE_OK,let pointer else { throw fail("Native database unavailable.") }
  do {
   guard sqlite3_exec(pointer,"CREATE TABLE IF NOT EXISTS workspaces(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL)",nil,nil,nil)==SQLITE_OK else {throw fail("Native database setup failed.")}
   try FileManager.default.setAttributes([.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication],ofItemAtPath:file.path)
   database = pointer
   return pointer
  } catch {sqlite3_close(pointer);throw error}
 }
 private func workspace(_ call:CAPPluginCall) throws -> String {
  guard let name=call.getString("name"),name.range(of:"^lifeos-(local|places|account-[0-9a-f-]{36})$",options:.regularExpression) != nil else {throw fail("Invalid workspace.")}
  return name
 }
 private func read(_ db:OpaquePointer,_ name:String) throws -> (Int64,String?) {
  var statement: OpaquePointer?
  guard sqlite3_prepare_v2(db,"SELECT revision,value FROM workspaces WHERE name=?",-1,&statement,nil)==SQLITE_OK else {throw fail("Read failed.")}
  defer{sqlite3_finalize(statement)}
  sqlite3_bind_text(statement,1,name,-1,transient)
  let result=sqlite3_step(statement)
  if result==SQLITE_DONE{return (0,nil)}
  guard result==SQLITE_ROW,let text=sqlite3_column_text(statement,1) else {throw fail("Read failed.")}
  return (sqlite3_column_int64(statement,0),String(cString:text))
 }
 @objc func readWorkspace(_ call:CAPPluginCall){
  queue.async {
   do{let result=try self.read(self.open(),self.workspace(call));call.resolve(["revision":result.0,"value":result.1 as Any? ?? NSNull()])}
   catch{call.reject("Native storage could not be read. Existing data was preserved.")}
  }
 }
 @objc func writeWorkspace(_ call:CAPPluginCall){
  queue.async {
   do{
    let db=try self.open(),name=try self.workspace(call)
    guard let expected=call.getInt("expected"),expected>=0,expected<9007199254740991,
     let value=call.getString("value"),value.utf8.count<=25000000,let data=value.data(using:.utf8),
     (try JSONSerialization.jsonObject(with:data)) is [String:Any] else {throw self.fail("Invalid native write.")}
    guard sqlite3_exec(db,"BEGIN IMMEDIATE",nil,nil,nil)==SQLITE_OK else {throw self.fail("Transaction unavailable.")}
    var committed=false
    defer{if !committed{sqlite3_exec(db,"ROLLBACK",nil,nil,nil)}}
    guard try self.read(db,name).0==Int64(expected) else {throw self.fail("Native records changed. Reload or retry.")}
    var statement:OpaquePointer?
    guard sqlite3_prepare_v2(db,"INSERT OR REPLACE INTO workspaces(name,revision,value) VALUES(?,?,?)",-1,&statement,nil)==SQLITE_OK else {throw self.fail("Save failed.")}
    defer{sqlite3_finalize(statement)}
    sqlite3_bind_text(statement,1,name,-1,self.transient)
    sqlite3_bind_int64(statement,2,Int64(expected)+1)
    sqlite3_bind_text(statement,3,value,-1,self.transient)
    guard sqlite3_step(statement)==SQLITE_DONE,sqlite3_exec(db,"COMMIT",nil,nil,nil)==SQLITE_OK else {throw self.fail("Save failed.")}
    committed=true;call.resolve()
   }catch{call.reject(error.localizedDescription)}
  }
 }
 private func secretQuery(_ call:CAPPluginCall) throws -> [String:Any] {
  guard let key=call.getString("key"),key.hasPrefix("sb-"),key.count<=200 else {throw fail("Invalid account key.")}
  return [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:key]
 }
 @objc func secretGet(_ call:CAPPluginCall){
  do{
   var query=try secretQuery(call);query[kSecReturnData as String]=true;query[kSecMatchLimit as String]=kSecMatchLimitOne
   var result:CFTypeRef?;let status=SecItemCopyMatching(query as CFDictionary,&result)
   if status==errSecItemNotFound{call.resolve(["value":NSNull()]);return}
   guard status==errSecSuccess,let data=result as? Data,let value=String(data:data,encoding:.utf8) else {throw fail("Keychain unavailable.")}
   call.resolve(["value":value])
  }catch{call.reject("Secure account storage is unavailable. No fallback storage was used.")}
 }
 @objc func secretSet(_ call:CAPPluginCall){
  do{
   let query=try secretQuery(call)
   guard let value=call.getString("value"),let data=value.data(using:.utf8),data.count<=65536 else {throw fail("Invalid account value.")}
   var status=SecItemUpdate(query as CFDictionary,[kSecValueData as String:data] as CFDictionary)
   if status==errSecItemNotFound{
    var item=query;item[kSecValueData as String]=data;item[kSecAttrAccessible as String]=kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    status=SecItemAdd(item as CFDictionary,nil)
   }
   guard status==errSecSuccess else {throw fail("Keychain save failed.")};call.resolve()
  }catch{call.reject("Secure account storage could not be saved.")}
 }
 @objc func secretRemove(_ call:CAPPluginCall){
  do{
   let status=SecItemDelete(try secretQuery(call) as CFDictionary)
   guard status==errSecSuccess||status==errSecItemNotFound else {throw fail("Keychain removal failed.")};call.resolve()
  }catch{call.reject("Secure account storage could not be cleared.")}
 }
 @objc func exportFile(_ call:CAPPluginCall){
  DispatchQueue.main.async{
   do{
    guard let name=call.getString("name"),name.range(of:"^[a-zA-Z0-9_.-]{1,120}\\.json$",options:.regularExpression) != nil,
     let value=call.getString("value"),let data=value.data(using:.utf8),data.count<=25000000 else {throw self.fail("Invalid backup.")}
    let directory=FileManager.default.temporaryDirectory.appendingPathComponent("lifeos-exports",isDirectory:true)
    try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
    for file in try FileManager.default.contentsOfDirectory(at:directory,includingPropertiesForKeys:nil){try FileManager.default.removeItem(at:file)}
    let file=directory.appendingPathComponent(name);try data.write(to:file,options:[.atomic,.completeFileProtection])
    let sheet=UIActivityViewController(activityItems:[file],applicationActivities:nil)
    sheet.popoverPresentationController?.sourceView=self.bridge?.viewController?.view
    sheet.completionWithItemsHandler={_,_,_,_ in try? FileManager.default.removeItem(at:file)}
    self.bridge?.viewController?.present(sheet,animated:true);call.resolve()
   }catch{call.reject("Could not open backup sharing.")}
  }
 }
 @objc func listPlaces(_ call:CAPPluginCall){do{call.resolve(["places":try GeoService.shared.places()])}catch{call.reject("Saved places are unreadable.")}}
 @objc func setPlaces(_ call:CAPPluginCall){
  DispatchQueue.main.async{
   do{
    guard let places=call.getArray("places",JSObject.self) else {throw self.fail("Invalid places.")}
    try GeoService.shared.save(places);call.resolve()
   }catch{call.reject(error.localizedDescription)}
  }
 }
 @objc func currentLocation(_ call:CAPPluginCall){DispatchQueue.main.async{GeoService.shared.locate(call)}}
 @objc func enablePlaces(_ call:CAPPluginCall){DispatchQueue.main.async{GeoService.shared.enable(call)}}
 @objc func disablePlaces(_ call:CAPPluginCall){DispatchQueue.main.async{GeoService.shared.disable();call.resolve()}}
 @objc func placeStatus(_ call:CAPPluginCall){call.resolve(["enabled":UserDefaults.standard.bool(forKey:"lifeos-arrivals-enabled")])}
 @objc func takeArrival(_ call:CAPPluginCall){DispatchQueue.main.async{let id=GeoService.shared.pending;GeoService.shared.pending=nil;call.resolve(["id":id as Any? ?? NSNull()])}}
}

final class GeoService:NSObject,CLLocationManagerDelegate,UNUserNotificationCenterDelegate {
 static let shared=GeoService()
 let manager=CLLocationManager()
 var locationCall:CAPPluginCall?
 var pending:String?
 override init(){
  super.init();manager.delegate=self
  UNUserNotificationCenter.current().delegate=self
 }
 func places() throws -> [[String:Any]]{
  guard let data=UserDefaults.standard.data(forKey:"lifeos-places") else{return []}
  guard let places=try JSONSerialization.jsonObject(with:data) as? [[String:Any]] else {throw NSError(domain:"LifeOS",code:1)}
  return places
 }
 func save(_ places:[[String:Any]]) throws {
  guard places.count<=10 else {throw NSError(domain:"LifeOS",code:1,userInfo:[NSLocalizedDescriptionKey:"Maximum 10 places."])}
  var ids=Set<String>()
  for p in places {
   guard let id=p["id"] as? String,id.range(of:"^[a-zA-Z0-9-]{1,64}$",options:.regularExpression) != nil,ids.insert(id).inserted,
    let name=p["name"] as? String,!name.trimmingCharacters(in:.whitespaces).isEmpty,name.count<=60,
    let activity=p["activity"] as? String,!activity.isEmpty,activity.count<=40,
    let lat=p["latitude"] as? Double,lat.isFinite,abs(lat)<=90,
    let lon=p["longitude"] as? Double,lon.isFinite,abs(lon)<=180,
    let radius=p["radius"] as? Double,radius.isFinite,(100...1000).contains(radius) else {throw NSError(domain:"LifeOS",code:1,userInfo:[NSLocalizedDescriptionKey:"Invalid saved place."])}
  }
  UserDefaults.standard.set(try JSONSerialization.data(withJSONObject:places),forKey:"lifeos-places")
  if UserDefaults.standard.bool(forKey:"lifeos-arrivals-enabled"){try register()}
 }
 func register() throws {
  guard manager.authorizationStatus == .authorizedAlways,CLLocationManager.isMonitoringAvailable(for:CLCircularRegion.self) else {
   UserDefaults.standard.set(false,forKey:"lifeos-arrivals-enabled")
   throw NSError(domain:"LifeOS",code:1,userInfo:[NSLocalizedDescriptionKey:"Set location permission to Always before enabling reminders."])
  }
  let saved=try places()
  for region in manager.monitoredRegions where region.identifier.hasPrefix("lifeos-"){manager.stopMonitoring(for:region)}
  for p in saved {
   guard let id=p["id"] as? String,let lat=p["latitude"] as? Double,let lon=p["longitude"] as? Double,let radius=p["radius"] as? Double else {continue}
   let region=CLCircularRegion(center:CLLocationCoordinate2D(latitude:lat,longitude:lon),radius:min(radius,manager.maximumRegionMonitoringDistance),identifier:"lifeos-"+id)
   region.notifyOnEntry=true;region.notifyOnExit=true;manager.startMonitoring(for:region)
  }
 }
 func enable(_ call:CAPPluginCall){
  guard let saved=try? places(),!saved.isEmpty else {call.reject("Save a place first.");return}
  if manager.authorizationStatus == .notDetermined {manager.requestWhenInUseAuthorization();call.reject("Allow location access, then enable arrival reminders again.");return}
  if manager.authorizationStatus != .authorizedAlways {manager.requestAlwaysAuthorization();call.reject("Choose Always in iOS location settings, then enable reminders again.");return}
  UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound]){granted,_ in
   DispatchQueue.main.async{
    guard granted else {call.reject("Notification permission was not granted.");return}
    do{try self.register();UserDefaults.standard.set(true,forKey:"lifeos-arrivals-enabled");call.resolve()}
    catch{call.reject(error.localizedDescription)}
   }
  }
 }
 func disable(){
  UserDefaults.standard.set(false,forKey:"lifeos-arrivals-enabled")
  for region in manager.monitoredRegions where region.identifier.hasPrefix("lifeos-"){manager.stopMonitoring(for:region)}
  UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
  UNUserNotificationCenter.current().removeAllDeliveredNotifications()
 }
 func locate(_ call:CAPPluginCall){
  if locationCall != nil {call.reject("A location request is already running.");return}
  switch manager.authorizationStatus {
  case .notDetermined:manager.requestWhenInUseAuthorization();call.reject("Allow location access, then save your place again.");return
  case .denied,.restricted:call.reject("Location permission denied. Manual tracking still works.");return
  default:break
  }
  locationCall=call;manager.desiredAccuracy=kCLLocationAccuracyHundredMeters;manager.requestLocation()
  DispatchQueue.main.asyncAfter(deadline:.now()+15){[weak self,weak call] in
   guard let self,let call,self.locationCall === call else{return}
   self.locationCall=nil;call.reject("Location request timed out. Try again.")
  }
 }
 func locationManager(_ manager:CLLocationManager,didUpdateLocations locations:[CLLocation]){
  guard let call=locationCall,let location=locations.last else{return}
  locationCall=nil;call.resolve(["latitude":location.coordinate.latitude,"longitude":location.coordinate.longitude])
 }
 func locationManager(_ manager:CLLocationManager,didFailWithError error:Error){locationCall?.reject("Location unavailable. Manual tracking still works.");locationCall=nil}
 func locationManager(_ manager:CLLocationManager,monitoringDidFailFor region:CLRegion?,withError error:Error){disable()}
 func locationManagerDidChangeAuthorization(_ manager:CLLocationManager){
  if manager.authorizationStatus != .authorizedAlways && UserDefaults.standard.bool(forKey:"lifeos-arrivals-enabled"){disable()}
 }
 func locationManager(_ manager:CLLocationManager,didEnterRegion region:CLRegion){
  guard UserDefaults.standard.bool(forKey:"lifeos-arrivals-enabled"),region.identifier.hasPrefix("lifeos-") else{return}
  let id=String(region.identifier.dropFirst(7)),key="inside-"+id
  guard !UserDefaults.standard.bool(forKey:key),let saved=try? places(),saved.contains(where:{$0["id"] as? String == id}) else{return}
  let content=UNMutableNotificationContent();content.title="LifeOS arrival reminder"
  content.body="Ready to start an activity? Open LifeOS to confirm.";content.userInfo=["place":id];content.sound = .default
  UNUserNotificationCenter.current().add(UNNotificationRequest(identifier:region.identifier,content:content,trigger:nil)){error in
   if error==nil{UserDefaults.standard.set(true,forKey:key)}
  }
 }
 func locationManager(_ manager:CLLocationManager,didExitRegion region:CLRegion){UserDefaults.standard.removeObject(forKey:"inside-"+String(region.identifier.dropFirst(7)))}
 func userNotificationCenter(_ center:UNUserNotificationCenter,didReceive response:UNNotificationResponse,withCompletionHandler completionHandler:@escaping()->Void){
  pending=response.notification.request.content.userInfo["place"] as? String
  NotificationCenter.default.post(name:Notification.Name("LifeOSArrival"),object:nil)
  completionHandler()
 }
 func userNotificationCenter(_ center:UNUserNotificationCenter,willPresent notification:UNNotification,withCompletionHandler completionHandler:@escaping(UNNotificationPresentationOptions)->Void){completionHandler([.banner,.sound])}
}
