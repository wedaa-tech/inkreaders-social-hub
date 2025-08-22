package config

import (
	"errors"
	"os"
)

type Config struct {
	Service string // BLUESKY_SERVICE
	Handle  string // BLUESKY_HANDLE
	Pass    string // BLUESKY_APP_PASSWORD
	Port    string // PORT
}

func Load() (*Config, error) {
	c := &Config{
		Service: os.Getenv("BLUESKY_SERVICE"),
		Handle:  os.Getenv("BLUESKY_HANDLE"),
		Pass:    os.Getenv("BLUESKY_APP_PASSWORD"),
		Port:    os.Getenv("PORT"),
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	if c.Service == "" || c.Handle == "" || c.Pass == "" {
		return nil, errors.New("BLUESKY_SERVICE, BLUESKY_HANDLE, BLUESKY_APP_PASSWORD required")
	}
	return c, nil
}
