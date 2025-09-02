package http

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

// doXrpcAuth performs an authenticated XRPC POST using a user session.
func doXrpcAuth(ctx context.Context, s *SessionData, method string, body any, out any) error {
    b, _ := json.Marshal(body)
    req, _ := http.NewRequestWithContext(ctx, "POST", s.PDSBase+"/xrpc/"+method, bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+s.AccessJWT)

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        buf, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("xrpc %s failed: status=%d body=%s", method, resp.StatusCode, string(buf))
    }

    if out != nil {
        return json.NewDecoder(resp.Body).Decode(out)
    }
    return nil
}
