// pkg/atp/xrpc.go
package atp

import (
  "bytes"
  "encoding/json"
  "errors"
  "net/http"
  "time"
)

type Session struct {
  DID         string `json:"did"`
  Handle      string `json:"handle"`
  AccessJwt   string `json:"accessJwt"`
  RefreshJwt  string `json:"refreshJwt"`
  ActiveUntil string `json:"activeUntil"` // RFC3339 or empty
}

func CreateSession(pds, identifier, appPassword string) (*Session, error) {
  body := map[string]string{
    "identifier": identifier,       // handle or email
    "password":   appPassword,      // app password (NOT regular password)
  }
  b, _ := json.Marshal(body)
  req, _ := http.NewRequest("POST", pds+"/xrpc/com.atproto.server.createSession", bytes.NewReader(b))
  req.Header.Set("Content-Type", "application/json")
  resp, err := http.DefaultClient.Do(req)
  if err != nil { return nil, err }
  defer resp.Body.Close()
  if resp.StatusCode != 200 { return nil, errors.New(resp.Status) }
  var s Session
  json.NewDecoder(resp.Body).Decode(&s)
  return &s, nil
}

func RefreshSession(pds string, refreshJwt string) (*Session, error) {
  req, _ := http.NewRequest("POST", pds+"/xrpc/com.atproto.server.refreshSession", nil)
  req.Header.Set("Authorization", "Bearer "+refreshJwt)
  resp, err := http.DefaultClient.Do(req)
  if err != nil { return nil, err }
  defer resp.Body.Close()
  if resp.StatusCode != 200 { return nil, errors.New(resp.Status) }
  var s Session
  json.NewDecoder(resp.Body).Decode(&s)
  return &s, nil
}

func ParseActiveUntil(s *Session) time.Time {
  if s.ActiveUntil == "" { return time.Now().Add(6 * time.Hour) }
  t, _ := time.Parse(time.RFC3339, s.ActiveUntil)
  return t
}
