# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Enable automatic Go toolchain downloads
ENV GOTOOLCHAIN=auto

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN GOTOOLCHAIN=auto CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

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
