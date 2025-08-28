package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
)

type SecretBox struct{ aead cipher.AEAD }

func NewSecretBox(b64key string) (*SecretBox, error) {
	key, err := base64.StdEncoding.DecodeString(b64key)
	if err != nil { return nil, err }
	block, err := aes.NewCipher(key)
	if err != nil { return nil, err }
	aead, err := cipher.NewGCM(block)
	if err != nil { return nil, err }
	return &SecretBox{aead}, nil
}

func (s *SecretBox) Seal(plain []byte) ([]byte, error) {
	nonce := make([]byte, s.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil { return nil, err }
	return s.aead.Seal(nonce, nonce, plain, nil), nil
}

func (s *SecretBox) Open(box []byte) ([]byte, error) {
	n := s.aead.NonceSize()
	if len(box) < n { return nil, errors.New("ciphertext too short") }
	return s.aead.Open(nil, box[:n], box[n:], nil)
}
