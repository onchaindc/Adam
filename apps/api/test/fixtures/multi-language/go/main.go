package main

import (
	"math/rand"
)

func run() {
	for i := 0; i < 10; i++ {
		go func() { panic(rand.Int()) }()
	}
	_ = load()
}

func load() error { return nil }
