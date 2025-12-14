# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Enable automatic Go toolchain downloads
ENV GOTOOLCHAIN=auto

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Download required Go toolchain
RUN go install golang.org/dl/go1.24.11@latest && \
    go1.24.11 download

# Copy source code
COPY . .

# Update go.mod for the new toolchain and build
RUN go1.24.11 mod tidy && \
    go1.24.11 build -o main .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/IdentitySBT.abi .

# Expose port
EXPOSE 8080

CMD ["./main"]
