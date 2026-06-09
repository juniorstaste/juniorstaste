// Nutzerfreundliche Meldung je Geolocation-Fehlerursache.
//
// Ohne Unterscheidung wirkt "Standort konnte nicht abgerufen werden" bei
// blockierter Berechtigung wie ein App-Fehler — dabei muss der Nutzer den
// Zugriff selbst wieder erlauben.
export function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Standortzugriff ist blockiert. Bitte erlaube ihn in den Browser-Einstellungen und versuche es erneut.";
  }

  if (error.code === error.TIMEOUT) {
    return "Die Standortabfrage hat zu lange gedauert. Bitte versuche es erneut.";
  }

  return "Standort konnte nicht ermittelt werden. Bitte versuche es erneut.";
}
